use std::collections::{BTreeMap, VecDeque};
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

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
        if path.ends_with('/') {
            continue;
        }
        // A submodule is listed like a file but is a directory on disk.
        let is_dir = fs::symlink_metadata(workspace.join(&path)).is_ok_and(|m| m.is_dir());
        if is_dir {
            entries.insert(format!("{path}/"), true);
        } else {
            entries.insert(path, false);
        }
    }
    finish(workspace, entries, cap)
}

fn finish(workspace: &Path, entries: BTreeMap<String, bool>, cap: usize) -> FileList {
    let mut kept: Vec<(String, bool)> = entries.into_iter().collect();
    if kept.len() > cap {
        // Shallow paths first, as the walk keeps them, so both ways cap the same entries.
        let depth = |p: &str| p.trim_end_matches('/').matches('/').count();
        kept.sort_by(|a, b| depth(&a.0).cmp(&depth(&b.0)).then_with(|| a.0.cmp(&b.0)));
        kept.truncate(cap);
        kept.sort();
    }
    FileList {
        folder: folder_name(workspace),
        entries: kept
            .into_iter()
            .map(|(path, dir)| FileEntry { path, dir })
            .collect(),
    }
}

fn walk_files(workspace: &Path, cap: usize) -> FileList {
    let mut entries = BTreeMap::new();
    walk(workspace, cap, &mut entries);
    finish(workspace, entries, cap)
}

/// Breadth-first with sorted folders, so the cap keeps shallow files deterministically.
fn walk(root: &Path, cap: usize, out: &mut BTreeMap<String, bool>) {
    let mut queue = VecDeque::from([(root.to_path_buf(), String::new())]);
    while let Some((dir, prefix)) = queue.pop_front() {
        let Ok(read) = fs::read_dir(&dir) else {
            continue;
        };
        let mut children: Vec<_> = read.flatten().collect();
        children.sort_by_key(|e| e.file_name());
        for entry in children {
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
            let path = entry.path();
            if kind.is_dir() {
                let rel = format!("{prefix}{name}/");
                out.insert(rel.clone(), true);
                queue.push_back((path, rel));
            } else if kind.is_symlink() && fs::metadata(&path).is_ok_and(|m| m.is_dir()) {
                out.insert(format!("{prefix}{name}/"), true);
            } else {
                out.insert(format!("{prefix}{name}"), false);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::suggest::test_util::write;
    use tempfile::TempDir;

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
        assert!(
            !paths(&list)
                .iter()
                .any(|p| p.starts_with("real/loop/") && p != "real/loop/")
        );
    }

    #[test]
    fn untracked_nested_repo_is_a_folder_not_a_file() {
        let d = TempDir::new().unwrap();
        git(d.path(), &["init", "-q"]);
        write(d.path(), "top.txt", "t");
        let nested = d.path().join("nested");
        fs::create_dir_all(&nested).unwrap();
        git(&nested, &["init", "-q"]);
        write(&nested, "inner.txt", "i");
        let list = files(d.path());
        let entry = list.entries.iter().find(|e| e.path == "nested/").unwrap();
        assert!(entry.dir);
        assert!(!paths(&list).contains(&"nested".to_string()));
    }

    #[test]
    fn walk_lists_root_files_before_deep_trees() {
        let d = TempDir::new().unwrap();
        write(d.path(), "z.md", "z");
        for i in 0..10 {
            write(d.path(), &format!("a/f{i}.txt"), "x");
        }
        let list = walk_files(d.path(), 3);
        assert!(paths(&list).contains(&"z.md".to_string()));
        assert_eq!(list.entries.len(), 3);
    }

    #[test]
    fn git_list_keeps_shallow_entries_at_the_cap_like_the_walk() {
        let d = TempDir::new().unwrap();
        git(d.path(), &["init", "-q"]);
        write(d.path(), "z.md", "z");
        for i in 0..10 {
            write(d.path(), &format!("a/f{i}.txt"), "x");
        }
        let list = files_capped(d.path(), 3);
        assert_eq!(paths(&list), ["a/", "a/f0.txt", "z.md"]);
    }

    #[cfg(unix)]
    #[test]
    fn walk_records_a_symlink_to_a_folder_as_a_folder() {
        let d = TempDir::new().unwrap();
        write(d.path(), "real/a.txt", "a");
        std::os::unix::fs::symlink(d.path().join("real"), d.path().join("link")).unwrap();
        let list = walk_files(d.path(), 100);
        let link = list.entries.iter().find(|e| e.path == "link/").unwrap();
        assert!(link.dir);
        assert!(
            !paths(&list)
                .iter()
                .any(|p| p.starts_with("link/") && p != "link/")
        );
        assert!(!paths(&list).contains(&"link".to_string()));
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
}
