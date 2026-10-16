use std::collections::HashMap;
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use serde_json::{Value, json};
use tiny_http::{Method, Request, Response, Server};

const MAX_BODY: usize = 256 * 1024;
const HOOK_PATH: &str = "/hook/";

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
/// token in its path.
pub struct HookServer {
    port: u16,
    sinks: Sinks,
    server: Arc<Server>,
    stopping: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl HookServer {
    pub fn start() -> std::io::Result<HookServer> {
        let server = Server::http("127.0.0.1:0").map_err(std::io::Error::other)?;
        let port = server
            .server_addr()
            .to_ip()
            .map(|addr| addr.port())
            .ok_or_else(|| std::io::Error::other("listener has no IP address"))?;
        let server = Arc::new(server);
        let sinks: Sinks = Arc::default();
        let stopping = Arc::new(AtomicBool::new(false));
        let thread = {
            let (server, sinks, stopping) = (server.clone(), sinks.clone(), stopping.clone());
            std::thread::Builder::new()
                .name("hook-listener".into())
                .spawn(move || serve(&server, &sinks, &stopping))?
        };
        Ok(HookServer {
            port,
            sinks,
            server,
            stopping,
            thread: Some(thread),
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
    fn drop(&mut self) {
        self.stopping.store(true, Ordering::SeqCst);
        self.server.unblock();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn serve(server: &Server, sinks: &Sinks, stopping: &AtomicBool) {
    loop {
        match server.recv() {
            Ok(request) => handle(request, sinks),
            Err(_) if stopping.load(Ordering::SeqCst) => return,
            Err(e) => eprintln!("hook listener: {e}"),
        }
    }
}

fn handle(mut request: Request, sinks: &Sinks) {
    let accepted = accept(&mut request, sinks);
    let status = match &accepted {
        Ok(_) => 200,
        Err(code) => *code,
    };
    // Always an empty body: a `SessionStart` command hook's stdout would be
    // added to Claude's context.
    let _ = request.respond(Response::empty(status));
    if let Ok((sink, event)) = accepted {
        sink.hook(event);
    }
}

/// The sink and parsed event of a valid hook POST, or the status to answer with.
fn accept(request: &mut Request, sinks: &Sinks) -> Result<(Arc<dyn HookSink>, Value), u16> {
    if *request.method() != Method::Post {
        return Err(405);
    }
    let token = request.url().strip_prefix(HOOK_PATH).ok_or(404u16)?;
    let sink = sinks.lock().unwrap().get(token).cloned().ok_or(404u16)?;
    if request.body_length().is_some_and(|len| len > MAX_BODY) {
        return Err(413);
    }
    let mut body = Vec::new();
    request
        .as_reader()
        .take(MAX_BODY as u64 + 1)
        .read_to_end(&mut body)
        .map_err(|_| 400u16)?;
    if body.len() > MAX_BODY {
        return Err(413);
    }
    let event = serde_json::from_slice(&body).map_err(|_| 400u16)?;
    Ok((sink, event))
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

    /// Requests are handled one at a time, so a later good request that arrives
    /// first proves the earlier one never reached a sink.
    fn assert_next_is(rx: &Receiver<(Value, Instant)>, expected: Value) {
        let (got, _) = rx
            .recv_timeout(Duration::from_secs(3))
            .expect("no sink call");
        assert_eq!(got, expected);
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
    fn response_body_is_empty() {
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
            assert!(
                head.to_ascii_lowercase().contains("content-length: 0"),
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

        post(port, "/hook/other", r#"{"n":1}"#);
        send(port, "GET", "/hook/good", b"");
        send(port, "PUT", "/hook/good", br#"{"n":2}"#);
        post(port, "/good", r#"{"n":3}"#);
        post(port, "/hook/good/extra", r#"{"n":4}"#);
        post(port, "/hook/good", "{not json");
        post(port, "/hook/good", r#"{"n":5}"#);

        assert_next_is(&rx, json!({"n": 5}));
        assert!(rx.try_recv().is_err());
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
        post(server.port(), "/hook/kept", r#"{"n":2}"#);

        assert_next_is(&kept_rx, json!({"n": 2}));
        assert!(gone_rx.try_recv().is_err());
    }

    #[test]
    fn body_over_256_kib_reaches_no_sink() {
        let server = HookServer::start().unwrap();
        let (sink, rx) = recorder();
        server.register("t", sink);
        let big = format!(r#"{{"pad":"{}"}}"#, "x".repeat(256 * 1024));

        let response = post(server.port(), "/hook/t", &big);
        post(server.port(), "/hook/t", r#"{"n":1}"#);

        assert!(!response.starts_with("HTTP/1.1 200"), "{response}");
        assert_next_is(&rx, json!({"n": 1}));
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
    fn drop_stops_the_listener() {
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
