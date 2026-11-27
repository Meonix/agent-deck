use std::fs;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum StoreError {
    TooLarge,
    NotAFile,
    NotFound,
    Io(String),
}

impl StoreError {
    pub fn code(&self) -> String {
        match self {
            StoreError::TooLarge => "too_large".to_string(),
            StoreError::NotAFile => "not_a_file".to_string(),
            StoreError::NotFound => "not_found".to_string(),
            StoreError::Io(text) => text.clone(),
        }
    }
}

impl From<io::Error> for StoreError {
    fn from(e: io::Error) -> Self {
        if e.kind() == io::ErrorKind::NotFound {
            StoreError::NotFound
        } else {
            StoreError::Io(e.to_string())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct SavedFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn check_size(len: u64) -> Result<(), StoreError> {
    if len > MAX_BYTES {
        Err(StoreError::TooLarge)
    } else {
        Ok(())
    }
}

fn reduce_name(name: &str) -> String {
    let last = name.rsplit(['/', '\\']).next().unwrap_or("");
    match last {
        "" | "." | ".." => "file".to_string(),
        other => other.to_string(),
    }
}

// The counter keeps ids unique when two files land in the same millisecond.
fn new_dir(root: &Path) -> Result<std::path::PathBuf, StoreError> {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let dir = root.join(format!("{ms}-{}", COUNTER.fetch_add(1, Ordering::Relaxed)));
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn saved(path: &Path, name: String, size: u64) -> SavedFile {
    SavedFile {
        path: path.to_string_lossy().into_owned(),
        name,
        size,
    }
}

pub fn store_bytes(root: &Path, name: &str, bytes: &[u8]) -> Result<SavedFile, StoreError> {
    check_size(bytes.len() as u64)?;
    let name = reduce_name(name);
    let path = new_dir(root)?.join(&name);
    fs::write(&path, bytes)?;
    Ok(saved(&path, name, bytes.len() as u64))
}

pub fn store_copy(root: &Path, source: &Path) -> Result<SavedFile, StoreError> {
    let meta = fs::metadata(source)?;
    if !meta.is_file() {
        return Err(StoreError::NotAFile);
    }
    check_size(meta.len())?;
    let name = reduce_name(
        &source
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
    );
    let path = new_dir(root)?.join(&name);
    let size = fs::copy(source, &path)?;
    Ok(saved(&path, name, size))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    fn root() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn reduces_names_to_the_last_component() {
        for (given, want) in [
            ("../x.png", "x.png"),
            ("a/b.png", "b.png"),
            ("a\\b.png", "b.png"),
            ("", "file"),
            ("..", "file"),
            (".", "file"),
            ("ảnh chụp.png", "ảnh chụp.png"),
        ] {
            let dir = root();
            let saved = store_bytes(dir.path(), given, b"x").unwrap();
            assert_eq!(saved.name, want, "for {given:?}");
            assert!(saved.path.ends_with(want));
        }
    }

    #[test]
    fn same_name_twice_gets_different_paths_and_both_stay() {
        let dir = root();
        let a = store_bytes(dir.path(), "a.txt", b"one").unwrap();
        let b = store_bytes(dir.path(), "a.txt", b"two").unwrap();
        assert_ne!(a.path, b.path);
        assert_eq!(fs::read(&a.path).unwrap(), b"one");
        assert_eq!(fs::read(&b.path).unwrap(), b"two");
    }

    #[test]
    fn stores_the_bytes_and_reports_size() {
        let dir = root();
        let saved = store_bytes(dir.path(), "a.bin", &[1, 2, 3]).unwrap();
        assert_eq!(fs::read(&saved.path).unwrap(), vec![1, 2, 3]);
        assert_eq!(saved.size, 3);
        assert!(Path::new(&saved.path).starts_with(dir.path()));
    }

    #[test]
    fn check_size_accepts_the_limit_and_rejects_one_over() {
        assert_eq!(check_size(MAX_BYTES), Ok(()));
        assert_eq!(check_size(MAX_BYTES + 1), Err(StoreError::TooLarge));
    }

    #[test]
    fn copy_keeps_the_source_and_the_content() {
        let dir = root();
        let src = dir.path().join("src.txt");
        fs::write(&src, "hello").unwrap();
        let saved = store_copy(&dir.path().join("store"), &src).unwrap();
        assert_eq!(saved.name, "src.txt");
        assert_eq!(saved.size, 5);
        assert_eq!(fs::read_to_string(&saved.path).unwrap(), "hello");
        assert_eq!(fs::read_to_string(&src).unwrap(), "hello");
    }

    #[test]
    fn copy_accepts_exactly_the_limit_and_rejects_one_over() {
        let dir = root();
        let ok = dir.path().join("ok.bin");
        File::create(&ok).unwrap().set_len(MAX_BYTES).unwrap();
        let big = dir.path().join("big.bin");
        File::create(&big).unwrap().set_len(MAX_BYTES + 1).unwrap();
        let store = dir.path().join("store");
        assert_eq!(store_copy(&store, &ok).unwrap().size, MAX_BYTES);
        assert_eq!(store_copy(&store, &big), Err(StoreError::TooLarge));
    }

    #[test]
    fn copy_of_a_folder_is_not_a_file() {
        let dir = root();
        assert_eq!(
            store_copy(&dir.path().join("s"), dir.path()),
            Err(StoreError::NotAFile)
        );
    }

    #[test]
    fn copy_of_a_missing_path_is_not_found() {
        let dir = root();
        assert_eq!(
            store_copy(&dir.path().join("s"), &dir.path().join("nope")),
            Err(StoreError::NotFound)
        );
    }

    #[cfg(unix)]
    #[test]
    fn copy_follows_a_symlink_to_a_file() {
        let dir = root();
        let target = dir.path().join("t.txt");
        fs::write(&target, "linked").unwrap();
        let link = dir.path().join("l.txt");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let saved = store_copy(&dir.path().join("s"), &link).unwrap();
        assert_eq!(saved.name, "l.txt");
        assert_eq!(fs::read_to_string(&saved.path).unwrap(), "linked");
        assert!(
            !fs::symlink_metadata(&saved.path)
                .unwrap()
                .file_type()
                .is_symlink()
        );
    }

    #[test]
    fn codes_are_the_wire_strings() {
        assert_eq!(StoreError::TooLarge.code(), "too_large");
        assert_eq!(StoreError::NotAFile.code(), "not_a_file");
        assert_eq!(StoreError::NotFound.code(), "not_found");
        assert_eq!(StoreError::Io("disk full".into()).code(), "disk full");
    }
}
