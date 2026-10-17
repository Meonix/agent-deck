//! Deleting a session moves its files to the operating system's trash (SRS-FR-047); nothing else is touched (SRS-NFR-005).

use std::io;
use std::path::{Path, PathBuf};

use crate::pty::PaneProcess;
use crate::session_list::{CwdMatcher, Head, first_cwd, session_files};

pub trait Trash {
    fn trash(&self, path: &Path) -> io::Result<()>;
}

#[derive(Debug)]
pub enum DeleteError {
    /// No session file with that id belongs to the workspace.
    NotFound,
    /// The session file could not be moved; the session is still listed (SRS-FR-050).
    Failed(io::Error),
}

pub fn trash_session(
    projects_dir: &Path,
    workspace: &Path,
    session_id: &str,
    trash: &dyn Trash,
) -> Result<(), DeleteError> {
    let file = session_file(projects_dir, workspace, session_id)?;
    trash.trash(&file).map_err(DeleteError::Failed)?;
    // Without its .jsonl the session is gone from Claude Code and from the list, so a left-over folder is only logged.
    let folder = file.with_extension("");
    if folder.is_dir() {
        if let Err(e) = trash.trash(&folder) {
            crate::diag::warn(
                "session_trash",
                &format!("session folder {} stayed: {e}", folder.display()),
            );
        }
    }
    Ok(())
}

/// The macOS Trash or the Windows Recycle Bin.
pub struct SystemTrash;

#[cfg(target_os = "macos")]
impl Trash for SystemTrash {
    fn trash(&self, path: &Path) -> io::Result<()> {
        use objc2_foundation::{NSFileManager, NSString, NSURL};
        let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
        NSFileManager::defaultManager()
            .trashItemAtURL_resultingItemURL_error(&url, None)
            .map_err(|e| io::Error::other(e.localizedDescription().to_string()))
    }
}

#[cfg(windows)]
impl Trash for SystemTrash {
    fn trash(&self, path: &Path) -> io::Result<()> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::{
            FO_DELETE, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT,
            FOF_WANTNUKEWARNING, SHFILEOPSTRUCTW, SHFileOperationW,
        };
        // pFrom is a list of paths, each ending in a NUL, the list ending in a second NUL.
        let from: Vec<u16> = path.as_os_str().encode_wide().chain([0, 0]).collect();
        let mut op = SHFILEOPSTRUCTW {
            hwnd: std::ptr::null_mut(),
            wFunc: FO_DELETE,
            pFrom: from.as_ptr(),
            pTo: std::ptr::null(),
            // FOF_WANTNUKEWARNING: where the Recycle Bin cannot take the path, Windows asks
            // instead of deleting it for good; a refusal comes back as an abort.
            fFlags: (FOF_ALLOWUNDO
                | FOF_NOCONFIRMATION
                | FOF_NOERRORUI
                | FOF_SILENT
                | FOF_WANTNUKEWARNING) as u16,
            fAnyOperationsAborted: 0,
            hNameMappings: std::ptr::null_mut(),
            lpszProgressTitle: std::ptr::null(),
        };
        // SAFETY: `op` and the buffer it points into live until the call returns.
        let code = unsafe { SHFileOperationW(&mut op) };
        if code != 0 || op.fAnyOperationsAborted != 0 {
            return Err(io::Error::other(format!(
                "SHFileOperationW failed with {code:#x}"
            )));
        }
        Ok(())
    }
}

/// SRS-FR-049: an open session ends — its process reaped — before its files move.
pub fn delete_with_pane(
    process: Option<Box<dyn PaneProcess>>,
    trash_step: impl FnOnce() -> Result<(), DeleteError>,
) -> Result<(), DeleteError> {
    if let Some(mut process) = process {
        process.close();
    }
    trash_step()
}

/// The `<id>.jsonl` of this workspace, found the way the session list finds it (RULE-02).
fn session_file(
    projects_dir: &Path,
    workspace: &Path,
    session_id: &str,
) -> Result<PathBuf, DeleteError> {
    let plain = !session_id.is_empty()
        && session_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-');
    if !plain {
        return Err(DeleteError::NotFound);
    }
    let name = format!("{session_id}.jsonl");
    let mut matches = CwdMatcher::new(workspace);
    session_files(projects_dir)
        .map_err(DeleteError::Failed)?
        .into_iter()
        .map(|(_, file)| file)
        .find(|file| {
            file.file_name().is_some_and(|n| n == name.as_str())
                && matches!(first_cwd(file), Head::Cwd(cwd) if matches.is(&cwd))
        })
        .ok_or(DeleteError::NotFound)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::fs;
    use std::sync::{Arc, Mutex};
    use tempfile::TempDir;

    const WS: &str = "/Users/me/Project/agent-deck";
    const OTHER: &str = "/Users/me/Project/mokairo";

    #[derive(Default)]
    struct FakeTrash {
        moved: RefCell<Vec<PathBuf>>,
        /// File name of the one path that cannot be moved.
        fail_on: Option<&'static str>,
    }

    impl Trash for FakeTrash {
        fn trash(&self, path: &Path) -> io::Result<()> {
            if self
                .fail_on
                .is_some_and(|name| path.file_name().is_some_and(|n| n == name))
            {
                return Err(io::Error::new(io::ErrorKind::PermissionDenied, "locked"));
            }
            self.moved.borrow_mut().push(path.to_path_buf());
            Ok(())
        }
    }

    fn session_in(root: &TempDir, folder: &str, id: &str, cwd: &str, with_folder: bool) -> PathBuf {
        let dir = root.path().join(folder);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join(format!("{id}.jsonl"));
        fs::write(
            &file,
            format!("{}\n", serde_json::json!({"type": "user", "cwd": cwd})),
        )
        .unwrap();
        if with_folder {
            fs::create_dir_all(dir.join(id).join("subagents")).unwrap();
        }
        file
    }

    struct OrderedProcess(Arc<Mutex<Vec<&'static str>>>);

    impl PaneProcess for OrderedProcess {
        fn write(&mut self, _data: &[u8]) -> io::Result<()> {
            Ok(())
        }
        fn resize(&mut self, _cols: u16, _rows: u16) -> io::Result<()> {
            Ok(())
        }
        fn close(&mut self) {
            self.0.lock().unwrap().push("close");
        }
    }

    /// Leaves one `agent-deck-trash-probe-*` file in the user's Trash; run by hand with `--ignored`.
    #[test]
    #[ignore]
    #[cfg(target_os = "macos")]
    fn the_system_trash_takes_a_file() {
        let dir = TempDir::new().unwrap();
        let file = dir
            .path()
            .join(format!("agent-deck-trash-probe-{}", std::process::id()));
        fs::write(&file, "probe").unwrap();

        SystemTrash.trash(&file).unwrap();

        assert!(!file.exists());
        let trashed = dirs_trash().join(file.file_name().unwrap());
        assert!(trashed.exists(), "{} not in the Trash", trashed.display());
    }

    #[cfg(target_os = "macos")]
    fn dirs_trash() -> PathBuf {
        PathBuf::from(std::env::var("HOME").unwrap()).join(".Trash")
    }

    #[test]
    fn the_pane_is_closed_before_its_files_move() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let process: Box<dyn PaneProcess> = Box::new(OrderedProcess(events.clone()));

        let result = delete_with_pane(Some(process), || {
            events.lock().unwrap().push("trash");
            Ok(())
        });

        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), vec!["close", "trash"]);
    }

    #[test]
    fn moves_the_session_file_then_its_folder_and_nothing_else() {
        let root = TempDir::new().unwrap();
        let file = session_in(&root, "-Users-me-Project-agent-deck", "s-1", WS, true);
        session_in(&root, "-Users-me-Project-agent-deck", "s-2", WS, true);
        let trash = FakeTrash::default();

        trash_session(root.path(), Path::new(WS), "s-1", &trash).unwrap();

        let dir = file.parent().unwrap();
        assert_eq!(*trash.moved.borrow(), vec![file.clone(), dir.join("s-1")]);
    }

    #[test]
    fn a_session_without_its_folder_moves_only_the_file() {
        let root = TempDir::new().unwrap();
        let file = session_in(&root, "p", "s-1", WS, false);
        let trash = FakeTrash::default();

        trash_session(root.path(), Path::new(WS), "s-1", &trash).unwrap();

        assert_eq!(*trash.moved.borrow(), vec![file]);
    }

    #[test]
    fn refuses_a_session_of_another_workspace_or_a_path_like_id() {
        let root = TempDir::new().unwrap();
        session_in(&root, "-Users-me-Project-mokairo", "s-9", OTHER, true);
        let trash = FakeTrash::default();

        for id in ["s-9", "", "../s-9", "p/s-9", "s 9", "s-404"] {
            let result = trash_session(root.path(), Path::new(WS), id, &trash);
            assert!(matches!(result, Err(DeleteError::NotFound)), "{id:?}");
        }
        assert!(trash.moved.borrow().is_empty());
    }

    #[test]
    fn a_file_that_cannot_be_moved_fails_and_leaves_the_folder() {
        let root = TempDir::new().unwrap();
        session_in(&root, "p", "s-1", WS, true);
        let trash = FakeTrash {
            fail_on: Some("s-1.jsonl"),
            ..FakeTrash::default()
        };

        let result = trash_session(root.path(), Path::new(WS), "s-1", &trash);

        assert!(matches!(result, Err(DeleteError::Failed(_))));
        assert!(trash.moved.borrow().is_empty());
    }

    #[test]
    fn a_folder_that_cannot_be_moved_still_counts_as_deleted() {
        let root = TempDir::new().unwrap();
        let file = session_in(&root, "p", "s-1", WS, true);
        let trash = FakeTrash {
            fail_on: Some("s-1"),
            ..FakeTrash::default()
        };

        trash_session(root.path(), Path::new(WS), "s-1", &trash).unwrap();

        assert_eq!(*trash.moved.borrow(), vec![file]);
    }
}
