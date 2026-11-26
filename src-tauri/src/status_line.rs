//! The user's own Claude Code status line, read (never written) so the app's
//! status line can run it (SRS-NFR-006).

use std::path::Path;

use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub struct UserStatusLine {
    pub command: String,
    pub padding: Option<Value>,
    pub refresh_interval: Option<Value>,
}

/// The first `statusLine` with a string `command` in `<workspace>/.claude/settings.local.json`,
/// `<workspace>/.claude/settings.json`, then `<home>/.claude/settings.json`.
pub fn user_status_line(workspace: &Path, home: Option<&Path>) -> Option<UserStatusLine> {
    let claude = workspace.join(".claude");
    [
        claude.join("settings.local.json"),
        claude.join("settings.json"),
    ]
    .into_iter()
    .chain(home.map(|h| h.join(".claude").join("settings.json")))
    .find_map(|path| read_status_line(&path))
}

fn read_status_line(path: &Path) -> Option<UserStatusLine> {
    let settings: Value = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
    let line = &settings["statusLine"];
    Some(UserStatusLine {
        command: line["command"].as_str()?.to_string(),
        padding: line.get("padding").cloned(),
        refresh_interval: line.get("refreshInterval").cloned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::time::SystemTime;

    struct Dirs {
        ws: tempfile::TempDir,
        home: tempfile::TempDir,
    }

    impl Dirs {
        fn new() -> Self {
            Dirs {
                ws: tempfile::tempdir().unwrap(),
                home: tempfile::tempdir().unwrap(),
            }
        }

        fn local(&self) -> PathBuf {
            self.ws.path().join(".claude/settings.local.json")
        }

        fn project(&self) -> PathBuf {
            self.ws.path().join(".claude/settings.json")
        }

        fn user(&self) -> PathBuf {
            self.home.path().join(".claude/settings.json")
        }

        fn lookup(&self) -> Option<UserStatusLine> {
            user_status_line(self.ws.path(), Some(self.home.path()))
        }
    }

    fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    fn line(command: &str) -> String {
        json!({"statusLine": {"type": "command", "command": command}}).to_string()
    }

    fn command(found: Option<UserStatusLine>) -> Option<String> {
        found.map(|l| l.command)
    }

    #[test]
    fn local_settings_win_over_project_and_user() {
        let d = Dirs::new();
        write(&d.local(), &line("local"));
        write(&d.project(), &line("project"));
        write(&d.user(), &line("user"));
        assert_eq!(command(d.lookup()), Some("local".into()));
    }

    #[test]
    fn project_settings_win_over_user() {
        let d = Dirs::new();
        write(&d.local(), r#"{"permissions": {}}"#);
        write(&d.project(), &line("project"));
        write(&d.user(), &line("user"));
        assert_eq!(command(d.lookup()), Some("project".into()));
    }

    #[test]
    fn user_settings_are_read_last() {
        let d = Dirs::new();
        write(&d.user(), &line("sh ~/.claude/statusline.sh"));
        assert_eq!(
            command(d.lookup()),
            Some("sh ~/.claude/statusline.sh".into())
        );
    }

    #[test]
    fn a_status_line_without_a_string_command_is_skipped() {
        let d = Dirs::new();
        write(
            &d.local(),
            r#"{"statusLine": {"type": "command", "command": 3}}"#,
        );
        write(&d.project(), r#"{"statusLine": "sh x"}"#);
        write(&d.user(), &line("user"));
        assert_eq!(command(d.lookup()), Some("user".into()));
    }

    #[test]
    fn invalid_json_counts_as_no_setting() {
        let d = Dirs::new();
        write(&d.local(), "{\"statusLine\": {\"command\": \"broken\"");
        write(&d.project(), "[1, 2]");
        write(&d.user(), &line("user"));
        assert_eq!(command(d.lookup()), Some("user".into()));
    }

    #[test]
    fn padding_and_refresh_interval_are_copied() {
        let d = Dirs::new();
        write(
            &d.project(),
            r#"{"statusLine": {"type": "command", "command": "x", "padding": 2, "refreshInterval": 5}}"#,
        );
        assert_eq!(
            d.lookup(),
            Some(UserStatusLine {
                command: "x".into(),
                padding: Some(json!(2)),
                refresh_interval: Some(json!(5)),
            })
        );
        write(&d.local(), &line("y"));
        assert_eq!(
            d.lookup(),
            Some(UserStatusLine {
                command: "y".into(),
                padding: None,
                refresh_interval: None,
            })
        );
    }

    #[test]
    fn nothing_set_is_none() {
        let d = Dirs::new();
        assert_eq!(d.lookup(), None);
        write(&d.user(), r#"{"model": "opus"}"#);
        assert_eq!(d.lookup(), None);
    }

    #[test]
    fn without_a_home_only_the_workspace_is_read() {
        let d = Dirs::new();
        write(&d.project(), &line("project"));
        assert_eq!(
            command(user_status_line(d.ws.path(), None)),
            Some("project".into())
        );
    }

    /// SRS-NFR-005, SRS-NFR-006: the lookup reads only.
    #[test]
    fn the_lookup_changes_no_file() {
        let d = Dirs::new();
        write(&d.local(), "{not json");
        write(&d.project(), &line("project"));
        write(&d.user(), &line("user"));
        let snapshot = || -> Vec<(PathBuf, Vec<u8>, SystemTime)> {
            [d.local(), d.project(), d.user()]
                .into_iter()
                .map(|p| {
                    let modified = fs::metadata(&p).unwrap().modified().unwrap();
                    (p.clone(), fs::read(&p).unwrap(), modified)
                })
                .collect()
        };
        let listing = |dir: &Path| -> Vec<PathBuf> {
            let mut names: Vec<PathBuf> = fs::read_dir(dir)
                .unwrap()
                .map(|e| e.unwrap().path())
                .collect();
            names.sort();
            names
        };
        let before = snapshot();
        let dirs_before = (
            listing(&d.ws.path().join(".claude")),
            listing(&d.home.path().join(".claude")),
        );

        assert_eq!(command(d.lookup()), Some("project".into()));
        let empty = Dirs::new();
        assert_eq!(empty.lookup(), None);

        assert_eq!(snapshot(), before);
        assert_eq!(
            (
                listing(&d.ws.path().join(".claude")),
                listing(&d.home.path().join(".claude"))
            ),
            dirs_before
        );
        assert_eq!(fs::read_dir(empty.ws.path()).unwrap().count(), 0);
        assert_eq!(fs::read_dir(empty.home.path()).unwrap().count(), 0);
    }
}
