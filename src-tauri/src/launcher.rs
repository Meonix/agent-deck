use std::path::{Path, PathBuf};

pub const PATH_MARKER: &str = "__AD__";

/// Text between the first pair of `PATH_MARKER` in `output`, if any and non-empty.
pub fn parse_login_path(output: &str) -> Option<String> {
    let start = output.find(PATH_MARKER)? + PATH_MARKER.len();
    let len = output[start..].find(PATH_MARKER)?;
    let path = &output[start..start + len];
    (!path.is_empty()).then(|| path.to_string())
}

/// PATH as seen by the user's login shell, so a Finder launch finds `~/.local/bin`.
/// Returns `fallback` on any failure.
pub fn login_shell_path(fallback: &str) -> String {
    login_shell_path_with(std::env::var("SHELL").ok().as_deref(), fallback)
}

#[cfg(unix)]
pub fn login_shell_path_with(shell: Option<&str>, fallback: &str) -> String {
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::sync::mpsc;
    use std::time::Duration;

    let Some(shell) = shell.filter(|s| !s.is_empty()) else {
        return fallback.to_string();
    };
    let script = format!("printf \"{PATH_MARKER}%s{PATH_MARKER}\" \"$PATH\"");
    let Ok(mut child) = Command::new(shell)
        .args(["-l", "-c", &script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    else {
        return fallback.to_string();
    };
    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        return fallback.to_string();
    };

    // Read on a thread: a grandchild may keep the pipe open past the kill, and
    // the timeout must not wait for it.
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stdout.read_to_string(&mut buf);
        let _ = tx.send(buf);
    });
    let Ok(output) = rx.recv_timeout(Duration::from_secs(3)) else {
        let _ = child.kill();
        let _ = child.wait();
        return fallback.to_string();
    };
    match child.wait() {
        Ok(status) if status.success() => {
            parse_login_path(&output).unwrap_or_else(|| fallback.to_string())
        }
        _ => fallback.to_string(),
    }
}

#[cfg(not(unix))]
pub fn login_shell_path_with(_shell: Option<&str>, fallback: &str) -> String {
    fallback.to_string()
}

/// First entry of `path` containing an executable file `name`.
pub fn find_in_path(name: &str, path: &str) -> Option<PathBuf> {
    let names: Vec<String> = if cfg!(windows) {
        vec![
            name.to_string(),
            format!("{name}.exe"),
            format!("{name}.cmd"),
        ]
    } else {
        vec![name.to_string()]
    };
    std::env::split_paths(path)
        .filter(|dir| !dir.as_os_str().is_empty())
        .flat_map(|dir| names.iter().map(move |n| dir.join(n)))
        .find(|candidate| is_executable(candidate))
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.metadata()
        .is_ok_and(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

/// Set by a Claude Code session or a terminal that launched the app; passed on,
/// they would make `claude` think it runs nested or inside that terminal.
const INHERITED_ONLY: [&str; 7] = [
    "CLAUDECODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_EXECPATH",
    "CLAUDE_CODE_SSE_PORT",
    "CLAUDE_PID",
    "TERM_SESSION_ID",
];
const INHERITED_ONLY_PREFIXES: [&str; 6] = [
    "CLAUDE_CODE_SESSION_",
    "CLAUDE_CODE_MESSAGING_",
    "TERM_PROGRAM",
    "ITERM_",
    "VSCODE_",
    "npm_",
];

fn is_inherited_only(key: &str) -> bool {
    INHERITED_ONLY.contains(&key) || INHERITED_ONLY_PREFIXES.iter().any(|p| key.starts_with(p))
}

/// Environment for a session: `base` without what only the launching context
/// set, with PATH/TERM/COLORTERM set, plus `LANG` only when no locale variable
/// is present.
pub fn session_env(base: &[(String, String)], resolved_path: &str) -> Vec<(String, String)> {
    const OVERRIDDEN: [&str; 3] = ["PATH", "TERM", "COLORTERM"];
    let mut env: Vec<(String, String)> = base
        .iter()
        .filter(|(k, _)| !OVERRIDDEN.contains(&k.as_str()) && !is_inherited_only(k))
        .cloned()
        .collect();
    let has_locale = env
        .iter()
        .any(|(k, _)| matches!(k.as_str(), "LANG" | "LC_ALL" | "LC_CTYPE"));
    env.push(("PATH".into(), resolved_path.into()));
    env.push(("TERM".into(), "xterm-256color".into()));
    env.push(("COLORTERM".into(), "truecolor".into()));
    if !has_locale {
        env.push(("LANG".into(), "en_US.UTF-8".into()));
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{Duration, Instant};

    #[test]
    fn parse_extracts_between_markers_ignoring_noise() {
        assert_eq!(
            parse_login_path("motd\n__AD__/a:/b__AD__\n"),
            Some("/a:/b".to_string())
        );
    }

    #[test]
    fn parse_without_markers_is_none() {
        assert_eq!(parse_login_path("/a:/b"), None);
        assert_eq!(parse_login_path("__AD__/a:/b"), None);
    }

    #[test]
    fn parse_empty_between_markers_is_none() {
        assert_eq!(parse_login_path("x__AD____AD__y"), None);
    }

    #[test]
    fn login_shell_missing_shell_returns_fallback() {
        assert_eq!(login_shell_path_with(None, "/fb"), "/fb");
        assert_eq!(
            login_shell_path_with(Some("/nonexistent/shell"), "/fb"),
            "/fb"
        );
    }

    #[cfg(unix)]
    #[test]
    fn login_shell_real_shell_returns_path() {
        let p = login_shell_path_with(Some("/bin/sh"), "/fb");
        assert!(!p.is_empty());
        assert_ne!(p, "/fb");
    }

    #[cfg(unix)]
    #[test]
    fn login_shell_timeout_returns_fallback() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let fake = dir.path().join("slowsh");
        fs::write(&fake, "#!/bin/sh\nexec sleep 10\n").unwrap();
        fs::set_permissions(&fake, fs::Permissions::from_mode(0o755)).unwrap();
        let start = Instant::now();
        let p = login_shell_path_with(fake.to_str(), "/fb");
        assert_eq!(p, "/fb");
        assert!(start.elapsed() < Duration::from_secs(5));
    }

    #[cfg(unix)]
    fn make_file(dir: &std::path::Path, name: &str, mode: u32) {
        use std::os::unix::fs::PermissionsExt;
        let f = dir.join(name);
        fs::write(&f, "#!/bin/sh\n").unwrap();
        fs::set_permissions(&f, fs::Permissions::from_mode(mode)).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn find_in_path_picks_first_dir_with_executable() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        make_file(b.path(), "claude", 0o755);
        let path = std::env::join_paths([a.path(), b.path()]).unwrap();
        assert_eq!(
            find_in_path("claude", path.to_str().unwrap()),
            Some(b.path().join("claude"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn find_in_path_skips_non_executable() {
        let a = tempfile::tempdir().unwrap();
        make_file(a.path(), "claude", 0o644);
        assert_eq!(find_in_path("claude", a.path().to_str().unwrap()), None);
    }

    #[test]
    fn find_in_path_empty_path_is_none() {
        assert_eq!(find_in_path("claude", ""), None);
    }

    fn get<'a>(env: &'a [(String, String)], k: &str) -> Option<&'a str> {
        env.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_str())
    }

    fn pair(k: &str, v: &str) -> (String, String) {
        (k.to_string(), v.to_string())
    }

    #[test]
    fn session_env_adds_defaults() {
        let env = session_env(&[pair("HOME", "/h")], "/p");
        assert_eq!(get(&env, "PATH"), Some("/p"));
        assert_eq!(get(&env, "TERM"), Some("xterm-256color"));
        assert_eq!(get(&env, "COLORTERM"), Some("truecolor"));
        assert_eq!(get(&env, "LANG"), Some("en_US.UTF-8"));
        assert_eq!(get(&env, "HOME"), Some("/h"));
    }

    #[test]
    fn session_env_keeps_existing_locale() {
        let env = session_env(&[pair("LC_ALL", "vi_VN.UTF-8")], "/p");
        assert_eq!(get(&env, "LC_ALL"), Some("vi_VN.UTF-8"));
        assert_eq!(get(&env, "LANG"), None);
    }

    #[test]
    fn session_env_drops_what_the_parent_terminal_and_claude_set() {
        let leaked = [
            "CLAUDECODE",
            "CLAUDE_CODE_ENTRYPOINT",
            "CLAUDE_CODE_SESSION_ID",
            "CLAUDE_CODE_SESSION_ACCESS_TOKEN",
            "CLAUDE_CODE_CHILD_SESSION",
            "CLAUDE_CODE_MESSAGING_SOCKET",
            "CLAUDE_CODE_EXECPATH",
            "CLAUDE_CODE_SSE_PORT",
            "CLAUDE_PID",
            "TERM_PROGRAM",
            "TERM_PROGRAM_VERSION",
            "TERM_SESSION_ID",
            "ITERM_SESSION_ID",
            "ITERM_PROFILE",
            "VSCODE_PID",
            "VSCODE_GIT_IPC_HANDLE",
            "npm_config_prefix",
            "npm_lifecycle_event",
        ];
        let kept = [
            "CLAUDE_CODE_USE_BEDROCK",
            "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
            "ANTHROPIC_API_KEY",
            "ANTHROPIC_BASE_URL",
            "HOME",
            "SHELL",
            "NPM_TOKEN",
        ];
        let base: Vec<_> = leaked.iter().chain(&kept).map(|k| pair(k, "v")).collect();
        let env = session_env(&base, "/p");
        for k in leaked {
            assert_eq!(get(&env, k), None, "{k} leaked");
        }
        for k in kept {
            assert_eq!(get(&env, k), Some("v"), "{k} dropped");
        }
    }

    #[test]
    fn session_env_replaces_existing_path() {
        let env = session_env(&[pair("PATH", "/old")], "/new");
        assert_eq!(env.iter().filter(|(k, _)| k == "PATH").count(), 1);
        assert_eq!(get(&env, "PATH"), Some("/new"));
    }
}
