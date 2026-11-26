use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const DESCRIPTION_MAX_CHARS: usize = 80;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandItem {
    pub name: String,
    pub description: String,
    pub source: CommandSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandSource {
    UserSkill,
    UserCommand,
    WorkspaceSkill,
    WorkspaceCommand,
    Plugin,
}

/// `home` is the user's home folder; everything is read under `home/.claude`.
pub fn commands(home: &Path, workspace: &Path) -> Vec<CommandItem> {
    let user = home.join(".claude");
    let ws = workspace.join(".claude");
    let mut by_name: BTreeMap<String, CommandItem> = BTreeMap::new();
    // Inserted lowest priority first; a later insert replaces an earlier one.
    let mut add = |items: Vec<CommandItem>| {
        for item in items {
            by_name.insert(item.name.clone(), item);
        }
    };
    for (install, plugin) in enabled_plugin_installs(home, workspace) {
        add(read_commands_dir(
            &install.join("commands"),
            Some(&plugin),
            CommandSource::Plugin,
        ));
        add(read_skills_dir(
            &install.join("skills"),
            Some(&plugin),
            CommandSource::Plugin,
        ));
    }
    add(read_commands_dir(
        &user.join("commands"),
        None,
        CommandSource::UserCommand,
    ));
    add(read_skills_dir(
        &user.join("skills"),
        None,
        CommandSource::UserSkill,
    ));
    add(read_synced_skills(&user.join("skills").join("synced")));
    add(read_commands_dir(
        &ws.join("commands"),
        None,
        CommandSource::WorkspaceCommand,
    ));
    add(read_skills_dir(
        &ws.join("skills"),
        None,
        CommandSource::WorkspaceSkill,
    ));
    by_name.into_values().collect()
}

fn qualify(plugin: Option<&str>, name: &str) -> String {
    match plugin {
        Some(p) => format!("{p}:{name}"),
        None => name.to_string(),
    }
}

fn read_commands_dir(root: &Path, plugin: Option<&str>, source: CommandSource) -> Vec<CommandItem> {
    let mut out = Vec::new();
    collect_commands(root, root, plugin, source, &mut out);
    out
}

fn collect_commands(
    root: &Path,
    dir: &Path,
    plugin: Option<&str>,
    source: CommandSource,
    out: &mut Vec<CommandItem>,
) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_real_dir = entry.file_type().is_ok_and(|t| t.is_dir());
        if is_real_dir {
            collect_commands(root, &path, plugin, source, out);
            continue;
        }
        if path.is_dir() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let name = rel
            .with_extension("")
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(":");
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let fm = frontmatter(&text);
        out.push(CommandItem {
            name: qualify(plugin, &name),
            description: description(&fm),
            source,
        });
    }
}

fn read_skills_dir(root: &Path, plugin: Option<&str>, source: CommandSource) -> Vec<CommandItem> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| {
            let dir = entry.path();
            let text = fs::read_to_string(dir.join("SKILL.md")).ok()?;
            let fm = frontmatter(&text);
            if fm
                .iter()
                .any(|(k, v)| k == "user-invocable" && v == "false")
            {
                return None;
            }
            let dir_name = entry.file_name().to_string_lossy().into_owned();
            let name = fm
                .iter()
                .find(|(k, v)| k == "name" && !v.is_empty())
                .map(|(_, v)| v.clone())
                .unwrap_or(dir_name);
            Some(CommandItem {
                name: qualify(plugin, &name),
                description: description(&fm),
                source,
            })
        })
        .collect()
}

fn read_synced_skills(synced: &Path) -> Vec<CommandItem> {
    let Ok(entries) = fs::read_dir(synced) else {
        return Vec::new();
    };
    entries
        .flatten()
        .flat_map(|id| read_skills_dir(&id.path(), None, CommandSource::UserSkill))
        .collect()
}

/// (install folder, plugin name) of every plugin enabled across the settings files.
fn enabled_plugin_installs(home: &Path, workspace: &Path) -> Vec<(PathBuf, String)> {
    let mut enabled: BTreeMap<String, bool> = BTreeMap::new();
    let files = [
        home.join(".claude/settings.json"),
        workspace.join(".claude/settings.json"),
        workspace.join(".claude/settings.local.json"),
    ];
    for file in files {
        let Some(json) = read_json(&file) else {
            continue;
        };
        let Some(map) = json.get("enabledPlugins").and_then(|v| v.as_object()) else {
            continue;
        };
        for (id, on) in map {
            if let Some(on) = on.as_bool() {
                enabled.insert(id.clone(), on);
            }
        }
    }
    let Some(installed) = read_json(&home.join(".claude/plugins/installed_plugins.json")) else {
        return Vec::new();
    };
    enabled
        .into_iter()
        .filter(|(_, on)| *on)
        .filter_map(|(id, _)| {
            let path = installed
                .get("plugins")?
                .get(&id)?
                .get(0)?
                .get("installPath")?
                .as_str()?;
            let plugin = id.split('@').next().unwrap_or(&id).to_string();
            Some((PathBuf::from(path), plugin))
        })
        .collect()
}

fn read_json(path: &Path) -> Option<serde_json::Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

/// Top-level `key: value` lines of the block between the first `---` and the next one.
/// A block-scalar value (`|`, `>`) takes its first indented line.
fn frontmatter(text: &str) -> Vec<(String, String)> {
    let mut lines = text.lines();
    if lines.next().map(str::trim_end) != Some("---") {
        return Vec::new();
    }
    let body: Vec<&str> = lines.take_while(|l| l.trim_end() != "---").collect();
    let mut out = Vec::new();
    for (i, line) in body.iter().enumerate() {
        if line.starts_with(char::is_whitespace) {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let mut value = value.trim().to_string();
        if value.starts_with(['|', '>']) {
            value = body
                .get(i + 1)
                .filter(|l| l.starts_with(char::is_whitespace))
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
        }
        out.push((key.trim().to_string(), unquote(&value).to_string()));
    }
    out
}

fn unquote(value: &str) -> &str {
    for q in ['"', '\''] {
        if let Some(inner) = value.strip_prefix(q).and_then(|v| v.strip_suffix(q)) {
            return inner;
        }
    }
    value
}

fn description(fm: &[(String, String)]) -> String {
    fm.iter()
        .find(|(k, _)| k == "description")
        .and_then(|(_, v)| v.lines().next())
        .unwrap_or("")
        .trim()
        .chars()
        .take(DESCRIPTION_MAX_CHARS)
        .collect()
}

pub const FILE_CAP: usize = 20_000;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct FileEntry {
    pub path: String,
    pub dir: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct FileList {
    pub folder: String,
    pub entries: Vec<FileEntry>,
}

pub fn files(workspace: &Path) -> FileList {
    files_capped(workspace, FILE_CAP)
}

pub fn files_capped(workspace: &Path, cap: usize) -> FileList {
    match git_files(workspace) {
        Some(paths) => build_list(workspace, paths, cap),
        None => walk_files(workspace, cap),
    }
}

fn git_files(workspace: &Path) -> Option<Vec<String>> {
    let out = Command::new("git")
        .args([
            "-c",
            "core.fsmonitor=false",
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ])
        .current_dir(workspace)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(
        out.stdout
            .split(|b| *b == 0)
            .filter(|p| !p.is_empty())
            .map(|p| String::from_utf8_lossy(p).into_owned())
            .collect(),
    )
}

fn folder_name(workspace: &Path) -> String {
    workspace
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn build_list(workspace: &Path, paths: Vec<String>, cap: usize) -> FileList {
    let mut entries: BTreeMap<String, bool> = BTreeMap::new();
    for path in paths {
        if path.split('/').any(|part| part.starts_with('.')) {
            continue;
        }
        let mut at = 0;
        while let Some(i) = path[at..].find('/') {
            at += i + 1;
            entries.insert(path[..at].to_string(), true);
        }
        entries.insert(path, false);
    }
    finish(workspace, entries, cap)
}

fn finish(workspace: &Path, entries: BTreeMap<String, bool>, cap: usize) -> FileList {
    FileList {
        folder: folder_name(workspace),
        entries: entries
            .into_iter()
            .take(cap)
            .map(|(path, dir)| FileEntry { path, dir })
            .collect(),
    }
}

fn walk_files(workspace: &Path, cap: usize) -> FileList {
    let mut entries = BTreeMap::new();
    walk(workspace, "", cap, &mut entries);
    finish(workspace, entries, cap)
}

fn walk(dir: &Path, prefix: &str, cap: usize, out: &mut BTreeMap<String, bool>) {
    let Ok(read) = fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        if out.len() >= cap {
            return;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            let path = format!("{prefix}{name}/");
            out.insert(path.clone(), true);
            walk(&entry.path(), &path, cap, out);
        } else {
            out.insert(format!("{prefix}{name}"), false);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write(root: &Path, rel: &str, body: &str) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, body).unwrap();
    }

    fn find<'a>(items: &'a [CommandItem], name: &str) -> Option<&'a CommandItem> {
        items.iter().find(|i| i.name == name)
    }

    fn dirs() -> (TempDir, TempDir) {
        (TempDir::new().unwrap(), TempDir::new().unwrap())
    }

    #[test]
    fn reads_user_and_workspace_sources() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/skills/pdf/SKILL.md",
            "---\nname: pdf-tools\ndescription: \"Work with PDFs\"\n---\nbody",
        );
        write(h.path(), ".claude/commands/foo.md", "no frontmatter");
        write(
            w.path(),
            ".claude/skills/ws/SKILL.md",
            "---\ndescription: 'ws skill'\n---\n",
        );
        write(
            w.path(),
            ".claude/commands/opsx/apply.md",
            "---\ndescription: Apply\n---\n",
        );
        let items = commands(h.path(), w.path());
        let pdf = find(&items, "pdf-tools").unwrap();
        assert_eq!(pdf.source, CommandSource::UserSkill);
        assert_eq!(pdf.description, "Work with PDFs");
        let foo = find(&items, "foo").unwrap();
        assert_eq!(foo.source, CommandSource::UserCommand);
        assert_eq!(foo.description, "");
        let ws = find(&items, "ws").unwrap();
        assert_eq!(ws.source, CommandSource::WorkspaceSkill);
        assert_eq!(ws.description, "ws skill");
        let apply = find(&items, "opsx:apply").unwrap();
        assert_eq!(apply.source, CommandSource::WorkspaceCommand);
        let names: Vec<_> = items.iter().map(|i| i.name.clone()).collect();
        let mut sorted = names.clone();
        sorted.sort();
        assert_eq!(names, sorted);
    }

    #[test]
    fn synced_skills_are_user_skills_and_synced_itself_is_not() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/skills/synced/abc123/docs/SKILL.md",
            "---\ndescription: d\n---\n",
        );
        let items = commands(h.path(), w.path());
        assert_eq!(
            find(&items, "docs").unwrap().source,
            CommandSource::UserSkill
        );
        assert!(find(&items, "synced").is_none());
        assert!(find(&items, "abc123").is_none());
        assert_eq!(items.len(), 1);
    }

    fn plugin_setup(h: &Path) -> PathBuf {
        let install = h.join("plug");
        write(
            &install,
            "skills/brainstorming/SKILL.md",
            "---\ndescription: think\n---\n",
        );
        write(&install, "commands/go.md", "---\ndescription: go\n---\n");
        let json = format!(
            r#"{{"plugins":{{"superpowers@claude-plugins-official":[{{"installPath":"{}"}}]}}}}"#,
            install.display()
        );
        write(h, ".claude/plugins/installed_plugins.json", &json);
        install
    }

    #[test]
    fn enabled_plugin_lists_skills_and_commands() {
        let (h, w) = dirs();
        plugin_setup(h.path());
        write(
            h.path(),
            ".claude/settings.json",
            r#"{"enabledPlugins":{"superpowers@claude-plugins-official":true}}"#,
        );
        let items = commands(h.path(), w.path());
        let b = find(&items, "superpowers:brainstorming").unwrap();
        assert_eq!(b.source, CommandSource::Plugin);
        assert_eq!(b.description, "think");
        assert!(find(&items, "superpowers:go").is_some());
    }

    #[test]
    fn installed_but_not_enabled_plugin_is_absent() {
        let (h, w) = dirs();
        plugin_setup(h.path());
        assert!(commands(h.path(), w.path()).is_empty());
    }

    #[test]
    fn later_settings_file_can_disable_a_plugin() {
        let (h, w) = dirs();
        plugin_setup(h.path());
        write(
            h.path(),
            ".claude/settings.json",
            r#"{"enabledPlugins":{"superpowers@claude-plugins-official":true}}"#,
        );
        write(
            w.path(),
            ".claude/settings.local.json",
            r#"{"enabledPlugins":{"superpowers@claude-plugins-official":false}}"#,
        );
        assert!(commands(h.path(), w.path()).is_empty());
    }

    #[test]
    fn hidden_skills_and_dirs_without_skill_md_are_absent() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/skills/hid/SKILL.md",
            "---\nuser-invocable: false\n---\n",
        );
        write(h.path(), ".claude/skills/empty/README.md", "x");
        assert!(commands(h.path(), w.path()).is_empty());
    }

    #[test]
    fn workspace_wins_over_user_on_same_name() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/skills/x/SKILL.md",
            "---\ndescription: user\n---\n",
        );
        write(
            w.path(),
            ".claude/skills/x/SKILL.md",
            "---\ndescription: ws\n---\n",
        );
        let items = commands(h.path(), w.path());
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].source, CommandSource::WorkspaceSkill);
        assert_eq!(items[0].description, "ws");
    }

    #[test]
    fn description_is_first_line_cut_to_80_chars() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/commands/a.md",
            "---\ndescription: first\nsecond: x\n---\n",
        );
        let long = "é".repeat(100);
        write(
            h.path(),
            ".claude/commands/b.md",
            &format!("---\ndescription: {long}\n---\n"),
        );
        let items = commands(h.path(), w.path());
        assert_eq!(find(&items, "a").unwrap().description, "first");
        assert_eq!(find(&items, "b").unwrap().description.chars().count(), 80);
    }

    #[test]
    fn multi_line_description_keeps_first_line() {
        let (h, w) = dirs();
        write(
            h.path(),
            ".claude/commands/m.md",
            "---\ndescription: line one\n  line two\nother: y\n---\n",
        );
        let items = commands(h.path(), w.path());
        assert_eq!(find(&items, "m").unwrap().description, "line one");
    }

    #[test]
    fn bad_json_is_skipped() {
        let (h, w) = dirs();
        write(h.path(), ".claude/settings.json", "{nope");
        write(h.path(), ".claude/plugins/installed_plugins.json", "][");
        write(h.path(), ".claude/commands/ok.md", "");
        assert_eq!(commands(h.path(), w.path()).len(), 1);
    }

    #[test]
    fn serializes_camel_case_with_kebab_source() {
        let item = CommandItem {
            name: "opsx:apply".into(),
            description: "Apply".into(),
            source: CommandSource::WorkspaceCommand,
        };
        assert_eq!(
            serde_json::to_value(item).unwrap(),
            serde_json::json!({"name":"opsx:apply","description":"Apply","source":"workspace-command"})
        );
    }

    fn git(dir: &Path, args: &[&str]) {
        let ok = std::process::Command::new("git")
            .args(["-c", "user.email=t@t", "-c", "user.name=t"])
            .args(args)
            .current_dir(dir)
            .status()
            .unwrap()
            .success();
        assert!(ok, "git {args:?} failed");
    }

    fn paths(list: &FileList) -> Vec<String> {
        list.entries.iter().map(|e| e.path.clone()).collect()
    }

    #[test]
    fn files_in_a_git_repo_skip_ignored_and_hidden() {
        let d = TempDir::new().unwrap();
        git(d.path(), &["init", "-q"]);
        write(d.path(), ".gitignore", "node_modules/\n");
        write(d.path(), "src/App.tsx", "a");
        write(d.path(), "node_modules/x/index.js", "b");
        write(d.path(), ".env", "c");
        write(d.path(), ".github/ci.yml", "d");
        git(d.path(), &["add", "src/App.tsx"]);
        git(d.path(), &["commit", "-q", "-m", "init"]);
        write(d.path(), "src/new.ts", "e");
        let list = files(d.path());
        assert_eq!(paths(&list), ["src/", "src/App.tsx", "src/new.ts"]);
        assert!(list.entries[0].dir && !list.entries[1].dir);
    }

    #[test]
    fn files_without_git_walk_and_skip_hidden() {
        let d = TempDir::new().unwrap();
        let outside = !std::process::Command::new("git")
            .args(["-C"])
            .arg(d.path())
            .args(["rev-parse"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .unwrap()
            .success();
        assert!(outside, "temp dir is inside a git repo");
        write(d.path(), "notes.md", "n");
        write(d.path(), "docs/a.md", "a");
        write(d.path(), ".cache/x", "x");
        let list = files(d.path());
        assert_eq!(paths(&list), ["docs/", "docs/a.md", "notes.md"]);
    }

    #[test]
    fn walk_does_not_follow_symlinks() {
        let d = TempDir::new().unwrap();
        write(d.path(), "real/a.txt", "a");
        #[cfg(unix)]
        std::os::unix::fs::symlink(d.path(), d.path().join("real/loop")).unwrap();
        let list = walk_files(d.path(), 100);
        assert!(paths(&list).contains(&"real/a.txt".to_string()));
        assert!(!paths(&list).iter().any(|p| p.starts_with("real/loop/")));
    }

    #[test]
    fn files_stop_at_the_cap() {
        let d = TempDir::new().unwrap();
        for i in 0..10 {
            write(d.path(), &format!("f{i}.txt"), "x");
        }
        assert_eq!(files_capped(d.path(), 5).entries.len(), 5);
    }

    #[test]
    fn folder_is_the_workspace_name() {
        let d = TempDir::new().unwrap();
        let name = d.path().file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(files(d.path()).folder, name);
    }

    #[cfg(unix)]
    #[test]
    fn commands_survive_a_symlink_cycle() {
        let (h, w) = dirs();
        write(w.path(), ".claude/commands/a.md", "x");
        let dir = w.path().join(".claude/commands");
        std::os::unix::fs::symlink(&dir, dir.join("loop")).unwrap();
        let items = commands(h.path(), w.path());
        assert!(find(&items, "a").is_some());
    }
}
