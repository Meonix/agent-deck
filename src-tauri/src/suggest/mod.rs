//! What the Composer's "/" and "@" menus list (SRS-FR-159, SRS-FR-160).

mod commands;
mod files;

pub use commands::{CommandItem, CommandSource, commands};
pub use files::{FILE_CAP, FileEntry, FileList, files, files_capped};

#[cfg(test)]
mod test_util {
    use std::fs;
    use std::path::Path;

    pub fn write(root: &Path, rel: &str, body: &str) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, body).unwrap();
    }
}
