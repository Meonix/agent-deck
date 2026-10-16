use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde_json::{Value, json};

const HOOK_PATH: &str = "/hook/";
const MAX_BODY: usize = 256 * 1024;
const MAX_HEAD: usize = 16 * 1024;
const MAX_CONNECTIONS: usize = 64;
/// A client that stops sending or reading for this long is dropped.
const IO_TIMEOUT: Duration = Duration::from_secs(2);
const ACCEPT_RETRY: Duration = Duration::from_millis(50);
/// Closing with unread input makes the kernel reset the connection, which can
/// destroy the response before the client reads it, so leftovers are drained.
const MAX_DRAIN: usize = 1024 * 1024;

const HTTP_EVENTS: [&str; 10] = [
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "Notification",
    "PostToolUse",
    "PostToolUseFailure",
    "PermissionDenied",
    "Stop",
    "StopFailure",
    "SessionEnd",
];

/// `curl` in PowerShell is an alias of `Invoke-WebRequest`.
#[cfg(windows)]
const CURL: &str = "curl.exe";
#[cfg(not(windows))]
const CURL: &str = "curl";

pub trait HookSink: Send + Sync {
    fn hook(&self, event: Value);
}

type Sinks = Arc<Mutex<HashMap<String, Arc<dyn HookSink>>>>;

/// Loopback listener that hands each hook POST to the sink registered under the
/// token in its path. Each connection runs on its own short-lived thread.
pub struct HookServer {
    port: u16,
    sinks: Sinks,
    stopping: Arc<AtomicBool>,
    accept: Option<JoinHandle<()>>,
}

impl HookServer {
    pub fn start() -> std::io::Result<HookServer> {
        let listener = TcpListener::bind(("127.0.0.1", 0))?;
        let port = listener.local_addr()?.port();
        let sinks: Sinks = Arc::default();
        let stopping = Arc::new(AtomicBool::new(false));
        let accept = {
            let (sinks, stopping) = (sinks.clone(), stopping.clone());
            std::thread::Builder::new()
                .name("hook-listener".into())
                .spawn(move || accept_loop(listener, &sinks, &stopping))?
        };
        Ok(HookServer {
            port,
            sinks,
            stopping,
            accept: Some(accept),
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn url_for(&self, token: &str) -> String {
        format!("http://127.0.0.1:{}{HOOK_PATH}{token}", self.port)
    }

    pub fn register(&self, token: &str, sink: Arc<dyn HookSink>) {
        self.sinks.lock().unwrap().insert(token.to_string(), sink);
    }

    pub fn unregister(&self, token: &str) {
        self.sinks.lock().unwrap().remove(token);
    }

    #[cfg(test)]
    pub(crate) fn registered(&self) -> usize {
        self.sinks.lock().unwrap().len()
    }
}

impl Drop for HookServer {
    /// The accept loop owns the listener, so once it is joined the port is closed.
    fn drop(&mut self) {
        self.stopping.store(true, Ordering::SeqCst);
        // Wakes the blocking `accept`; without it the join would never return.
        if TcpStream::connect(("127.0.0.1", self.port)).is_ok()
            && let Some(accept) = self.accept.take()
        {
            let _ = accept.join();
        }
    }
}

fn accept_loop(listener: TcpListener, sinks: &Sinks, stopping: &AtomicBool) {
    let open = Arc::new(AtomicUsize::new(0));
    loop {
        let accepted = listener.accept();
        if stopping.load(Ordering::SeqCst) {
            return;
        }
        match accepted {
            Ok((stream, _)) => serve_on_thread(stream, sinks, &open),
            Err(e) => {
                eprintln!("hook listener: accept failed: {e}");
                std::thread::sleep(ACCEPT_RETRY);
            }
        }
    }
}

/// Counts a connection while its thread runs.
struct Slot(Arc<AtomicUsize>);

impl Drop for Slot {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

fn serve_on_thread(stream: TcpStream, sinks: &Sinks, open: &Arc<AtomicUsize>) {
    let slot = Slot(open.clone());
    if open.fetch_add(1, Ordering::SeqCst) >= MAX_CONNECTIONS {
        return;
    }
    let sinks = sinks.clone();
    let _ = std::thread::Builder::new()
        .name("hook-request".into())
        .spawn(move || {
            let _slot = slot;
            serve(stream, &sinks);
        });
}

fn serve(mut stream: TcpStream, sinks: &Sinks) {
    let _ = stream.set_read_timeout(Some(IO_TIMEOUT));
    let _ = stream.set_write_timeout(Some(IO_TIMEOUT));
    let accepted = read_hook(&mut stream, sinks);
    let status = match &accepted {
        Ok(_) => 200,
        Err(code) => *code,
    };
    // Always an empty body: a `SessionStart` command hook's stdout would be
    // added to Claude's context.
    let _ = stream.write_all(response(status).as_bytes());
    // Before the close, so a client that has read to the end has been delivered.
    if let Ok((sink, event)) = accepted {
        sink.hook(event);
    }
    let _ = stream.shutdown(Shutdown::Write);
    drain(&mut stream);
}

/// The sink and parsed event of a valid hook POST, or the status to answer with.
fn read_hook(stream: &mut TcpStream, sinks: &Sinks) -> Result<(Arc<dyn HookSink>, Value), u16> {
    let (head, mut body) = read_head(stream)?;
    let head = String::from_utf8(head).map_err(|_| 400u16)?;
    let request = Head::parse(&head).ok_or(400u16)?;
    if request.method != "POST" {
        return Err(405);
    }
    let token = request.target.strip_prefix(HOOK_PATH).ok_or(404u16)?;
    let sink = sinks.lock().unwrap().get(token).cloned().ok_or(404u16)?;
    if request.header("transfer-encoding").is_some() {
        return Err(411);
    }
    let length = content_length(request.header("content-length").ok_or(411u16)?)?;
    if body.len() < length {
        if request
            .header("expect")
            .is_some_and(|v| v.eq_ignore_ascii_case("100-continue"))
        {
            stream
                .write_all(b"HTTP/1.1 100 Continue\r\n\r\n")
                .map_err(|_| 400u16)?;
        }
        let start = body.len();
        body.resize(length, 0);
        stream.read_exact(&mut body[start..]).map_err(|_| 400u16)?;
    }
    body.truncate(length);
    let event = serde_json::from_slice(&body).map_err(|_| 400u16)?;
    Ok((sink, event))
}

/// The header block without its blank line, and any body bytes read with it.
fn read_head(stream: &mut TcpStream) -> Result<(Vec<u8>, Vec<u8>), u16> {
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    loop {
        if let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            if end > MAX_HEAD {
                return Err(431);
            }
            let rest = buf.split_off(end + 4);
            buf.truncate(end);
            return Ok((buf, rest));
        }
        if buf.len() > MAX_HEAD {
            return Err(431);
        }
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => return Err(400),
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
        }
    }
}

struct Head<'a> {
    method: &'a str,
    target: &'a str,
    headers: Vec<(&'a str, &'a str)>,
}

impl<'a> Head<'a> {
    fn parse(text: &'a str) -> Option<Head<'a>> {
        let mut lines = text.split("\r\n");
        let mut parts = lines.next()?.split(' ');
        let (method, target, version) = (parts.next()?, parts.next()?, parts.next()?);
        if parts.next().is_some() || !version.starts_with("HTTP/1.") {
            return None;
        }
        let headers = lines
            .map(|line| line.split_once(':').map(|(k, v)| (k.trim(), v.trim())))
            .collect::<Option<Vec<_>>>()?;
        Some(Head {
            method,
            target,
            headers,
        })
    }

    fn header(&self, name: &str) -> Option<&'a str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| *v)
    }
}

/// Checked as text so a huge value is refused without being used as a size.
fn content_length(value: &str) -> Result<usize, u16> {
    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
        return Err(400);
    }
    match value.parse::<usize>() {
        Ok(n) if n <= MAX_BODY => Ok(n),
        _ => Err(413),
    }
}

fn response(status: u16) -> String {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        411 => "Length Required",
        413 => "Content Too Large",
        431 => "Request Header Fields Too Large",
        _ => "Error",
    };
    format!("HTTP/1.1 {status} {reason}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
}

fn drain(stream: &mut TcpStream) {
    let deadline = Instant::now() + IO_TIMEOUT;
    let mut chunk = [0u8; 8192];
    let mut drained = 0;
    while drained < MAX_DRAIN && Instant::now() < deadline {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => return,
            Ok(n) => drained += n,
        }
    }
}

/// Inline `--settings` JSON that sends every event the status board uses to `url`.
pub fn hook_settings(url: &str) -> String {
    // `SessionStart` runs only command hooks; `'@-'` is quoted for PowerShell.
    let session_start = json!({
        "type": "command",
        "async": true,
        "command": format!("{CURL} -s -m 3 -X POST --data-binary '@-' {url}"),
    });
    let http = json!({"type": "http", "url": url, "timeout": 5});
    let mut hooks = serde_json::Map::new();
    hooks.insert("SessionStart".into(), json!([{ "hooks": [session_start] }]));
    for event in HTTP_EVENTS {
        hooks.insert(event.into(), json!([{ "hooks": [http.clone()] }]));
    }
    json!({ "hooks": hooks }).to_string()
}

#[cfg(test)]
pub(crate) mod test_client {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    /// Sends one raw HTTP/1.1 request and returns the whole response.
    pub fn send(port: u16, method: &str, path: &str, body: &[u8]) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let head = format!(
            "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream.write_all(head.as_bytes()).unwrap();
        stream.write_all(body).unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        String::from_utf8_lossy(&response).into_owned()
    }

    /// POSTs `body` to a `http://127.0.0.1:<port>/<path>` URL.
    pub fn post_url(url: &str, body: &str) -> String {
        let rest = url.strip_prefix("http://127.0.0.1:").expect("loopback url");
        let (port, path) = rest.split_at(rest.find('/').expect("path"));
        send(port.parse().unwrap(), "POST", path, body.as_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::test_client::send;
    use super::*;
    use serde_json::{Value, json};
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::sync::mpsc::{self, Receiver, Sender};
    use std::time::{Duration, Instant};

    struct Recorder(Mutex<Sender<(Value, Instant)>>);

    impl HookSink for Recorder {
        fn hook(&self, event: Value) {
            let _ = self.0.lock().unwrap().send((event, Instant::now()));
        }
    }

    fn recorder() -> (Arc<dyn HookSink>, Receiver<(Value, Instant)>) {
        let (tx, rx) = mpsc::channel();
        (Arc::new(Recorder(Mutex::new(tx))), rx)
    }

    fn post(port: u16, path: &str, body: &str) -> String {
        send(port, "POST", path, body.as_bytes())
    }

    /// Writes `request` as is and returns the whole response.
    fn raw(port: u16, request: &[u8]) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        stream.write_all(request).unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        String::from_utf8_lossy(&response).into_owned()
    }

    fn assert_next_is(rx: &Receiver<(Value, Instant)>, expected: Value) {
        let (got, _) = rx
            .recv_timeout(Duration::from_secs(3))
            .expect("no sink call");
        assert_eq!(got, expected);
    }

    /// The server calls the sink before it closes the connection, so once a
    /// response has ended any call it caused is already visible.
    fn assert_no_call(rx: &Receiver<(Value, Instant)>, what: &str) {
        assert!(rx.try_recv().is_err(), "{what} reached the sink");
    }

    #[test]
    fn post_to_a_registered_token_reaches_its_sink() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("tok-a", sink);

        let response = post(
            server.port(),
            "/hook/tok-a",
            r#"{"hook_event_name":"Stop"}"#,
        );

        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        assert_next_is(&rx, json!({"hook_event_name": "Stop"}));
        assert_eq!(
            server.url_for("tok-a"),
            format!("http://127.0.0.1:{}/hook/tok-a", server.port())
        );
    }

    #[test]
    fn every_response_is_empty_and_closes() {
        let server = HookServer::start().unwrap();
        let (sink, _rx) = recorder();
        server.register("t", sink);
        for (method, path, body) in [
            ("POST", "/hook/t", "{}"),
            ("POST", "/hook/unknown", "{}"),
            ("GET", "/hook/t", ""),
            ("POST", "/hook/t", "not json"),
        ] {
            let response = send(server.port(), method, path, body.as_bytes());
            let (head, rest) = response.split_once("\r\n\r\n").expect("full response");
            assert_eq!(rest, "", "{method} {path}: {response}");
            let head = head.to_ascii_lowercase();
            assert!(
                head.contains("content-length: 0"),
                "{method} {path}: {head}"
            );
            assert!(
                head.contains("connection: close"),
                "{method} {path}: {head}"
            );
        }
    }

    #[test]
    fn unknown_token_wrong_method_and_bad_json_reach_no_sink() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("good", sink);
        let port = server.port();

        for (method, path, body, status) in [
            ("POST", "/hook/other", r#"{"n":1}"#, "404"),
            ("GET", "/hook/good", "", "405"),
            ("PUT", "/hook/good", r#"{"n":2}"#, "405"),
            ("POST", "/good", r#"{"n":3}"#, "404"),
            ("POST", "/hook/good/extra", r#"{"n":4}"#, "404"),
            ("POST", "/hook/good", "{not json", "400"),
        ] {
            let response = send(port, method, path, body.as_bytes());
            assert!(
                response.starts_with(&format!("HTTP/1.1 {status}")),
                "{method} {path}: {response}"
            );
            assert_no_call(&rx, &format!("{method} {path}"));
        }
        post(port, "/hook/good", r#"{"n":5}"#);
        assert_next_is(&rx, json!({"n": 5}));
    }

    #[test]
    fn unregistered_token_reaches_no_sink() {
        let server = HookServer::start().unwrap();
        let (gone, gone_rx) = recorder();
        let (kept, kept_rx) = recorder();
        server.register("gone", gone);
        server.register("kept", kept);
        server.unregister("gone");

        post(server.port(), "/hook/gone", r#"{"n":1}"#);
        assert_no_call(&gone_rx, "unregistered token");
        post(server.port(), "/hook/kept", r#"{"n":2}"#);
        assert_next_is(&kept_rx, json!({"n": 2}));
    }

    #[test]
    fn body_over_256_kib_reaches_no_sink() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let big = format!(r#"{{"pad":"{}"}}"#, "x".repeat(256 * 1024));

        let response = post(server.port(), "/hook/t", &big);

        assert!(response.starts_with("HTTP/1.1 413"), "{response}");
        assert_no_call(&rx, "oversize body");
    }

    #[test]
    fn body_of_exactly_256_kib_is_accepted() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let overhead = r#"{"pad":""}"#.len();
        let body = format!(r#"{{"pad":"{}"}}"#, "x".repeat(256 * 1024 - overhead));
        assert_eq!(body.len(), 256 * 1024);

        post(server.port(), "/hook/t", &body);

        let (got, _) = rx.recv_timeout(Duration::from_secs(3)).expect("no call");
        assert_eq!(got["pad"].as_str().unwrap().len(), 256 * 1024 - overhead);
    }

    #[test]
    fn huge_content_length_is_refused_without_reading() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);

        for length in ["1000000000000000000", "99999999999999999999999999"] {
            let response = raw(
                server.port(),
                format!("POST /hook/t HTTP/1.1\r\nContent-Length: {length}\r\n\r\nabc").as_bytes(),
            );
            assert!(response.starts_with("HTTP/1.1 413"), "{length}: {response}");
            assert_no_call(&rx, length);
        }
        post(server.port(), "/hook/t", r#"{"n":1}"#);
        assert_next_is(&rx, json!({"n": 1}));
    }

    #[test]
    fn body_without_content_length_is_refused() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);

        for request in [
            "POST /hook/t HTTP/1.1\r\nConnection: close\r\n\r\n{}",
            "POST /hook/t HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n",
        ] {
            let response = raw(server.port(), request.as_bytes());
            assert!(
                response.starts_with("HTTP/1.1 411"),
                "{request}: {response}"
            );
            assert_no_call(&rx, request);
        }
    }

    #[test]
    fn oversized_header_block_is_refused() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let request = format!(
            "POST /hook/t HTTP/1.1\r\nX-Pad: {}\r\nContent-Length: 2\r\n\r\n{{}}",
            "x".repeat(20 * 1024)
        );

        let response = raw(server.port(), request.as_bytes());

        assert!(response.starts_with("HTTP/1.1 431"), "{response}");
        assert_no_call(&rx, "oversized headers");
    }

    #[test]
    fn expect_100_continue_gets_continue_then_delivers() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let body = r#"{"n":1}"#;
        let mut stream = TcpStream::connect(("127.0.0.1", server.port())).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let head = format!(
            "POST /hook/t HTTP/1.1\r\nContent-Length: {}\r\nExpect: 100-continue\r\n\r\n",
            body.len()
        );
        stream.write_all(head.as_bytes()).unwrap();

        let mut interim = Vec::new();
        let mut byte = [0u8; 1];
        while !interim.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte).unwrap();
            interim.push(byte[0]);
        }
        assert!(interim.starts_with(b"HTTP/1.1 100 "), "{interim:?}");
        stream.write_all(body.as_bytes()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();

        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        assert_next_is(&rx, json!({"n": 1}));
    }

    #[test]
    fn stalled_client_does_not_delay_another() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let mut stalled = TcpStream::connect(("127.0.0.1", server.port())).unwrap();
        stalled
            .write_all(b"POST /hook/t HTTP/1.1\r\nContent-Length: 4000\r\n\r\n{")
            .unwrap();
        std::thread::sleep(Duration::from_millis(50));

        let sent = Instant::now();
        let response = post(server.port(), "/hook/t", r#"{"n":1}"#);
        let (got, received) = rx.recv_timeout(Duration::from_secs(3)).expect("no call");

        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        assert_eq!(got, json!({"n": 1}));
        assert!(
            received - sent < Duration::from_millis(500),
            "{:?}",
            received - sent
        );
        drop(stalled);
    }

    /// SRS-FR-034: the listener adds well under 100 ms to the 3 s budget.
    #[test]
    fn post_to_sink_p95_is_under_100_ms() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let body = r#"{"hook_event_name":"PermissionRequest","tool_name":"Edit"}"#;
        let request = format!(
            "POST /hook/t HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: {}\r\n\
             Connection: close\r\n\r\n{body}",
            body.len()
        );

        let mut latencies: Vec<Duration> = (0..50)
            .map(|_| {
                let mut stream = TcpStream::connect(("127.0.0.1", server.port())).unwrap();
                let sent = Instant::now();
                stream.write_all(request.as_bytes()).unwrap();
                let (_, received) = rx.recv_timeout(Duration::from_secs(3)).expect("no call");
                let mut rest = Vec::new();
                let _ = stream.read_to_end(&mut rest);
                received - sent
            })
            .collect();
        latencies.sort();
        let (p50, p95) = (latencies[24], latencies[47]);
        println!("hook POST -> sink over 50 requests: p50 = {p50:?}, p95 = {p95:?}");
        assert!(p95 < Duration::from_millis(100), "p95 = {p95:?}");
    }

    #[test]
    fn drop_closes_the_listening_socket() {
        let server = HookServer::start().unwrap();
        let port = server.port();
        drop(server);
        assert!(TcpStream::connect(("127.0.0.1", port)).is_err());
    }

    const EVENTS: [&str; 11] = [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "Notification",
        "PostToolUse",
        "PostToolUseFailure",
        "PermissionDenied",
        "Stop",
        "StopFailure",
        "SessionEnd",
    ];

    #[test]
    fn hook_settings_has_one_handler_per_event() {
        let url = "http://127.0.0.1:4321/hook/abc";
        let text = hook_settings(url);
        assert!(!text.contains('\n'), "not compact: {text}");
        let settings: Value = serde_json::from_str(&text).unwrap();
        let hooks = settings["hooks"].as_object().expect("hooks object");
        let mut names: Vec<&str> = hooks.keys().map(String::as_str).collect();
        names.sort();
        let mut expected = EVENTS.to_vec();
        expected.sort();
        assert_eq!(names, expected);

        for event in EVENTS {
            let groups = hooks[event].as_array().expect(event);
            assert_eq!(groups.len(), 1, "{event}");
            let handlers = groups[0]["hooks"].as_array().expect(event);
            assert_eq!(handlers.len(), 1, "{event}");
            let handler = &handlers[0];
            if event == "SessionStart" {
                assert_eq!(handler["type"], "command");
                assert_eq!(handler["async"], true);
                let command = handler["command"].as_str().unwrap();
                let curl = if cfg!(windows) { "curl.exe " } else { "curl " };
                assert_eq!(
                    command,
                    format!("{curl}-s -m 3 -X POST --data-binary '@-' {url}")
                );
            } else {
                assert_eq!(
                    *handler,
                    json!({"type": "http", "url": url, "timeout": 5}),
                    "{event}"
                );
            }
        }
    }
}
