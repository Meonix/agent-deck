use std::path::{Path, PathBuf};

use tauri::ipc::InvokeBody;
use tauri::{AppHandle, Manager};

use crate::prompt_files::{self, SavedFile};

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("prompt-files"))
        .map_err(|e| e.to_string())
}

// The header carries encodeURIComponent output; invalid escapes pass through as typed.
fn percent_decode(text: &str) -> String {
    let raw = text.as_bytes();
    let hex = |at: usize| raw.get(at).and_then(|b| (*b as char).to_digit(16));
    let mut out = Vec::with_capacity(raw.len());
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%'
            && let (Some(hi), Some(lo)) = (hex(i + 1), hex(i + 2))
        {
            out.push((hi * 16 + lo) as u8);
            i += 3;
        } else {
            out.push(raw[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[tauri::command]
pub async fn save_prompt_file(
    request: tauri::ipc::Request<'_>,
    app: AppHandle,
) -> Result<SavedFile, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("bad_request".to_string());
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode)
        .unwrap_or_default();
    prompt_files::check_size(bytes.len() as u64).map_err(|e| e.code())?;
    let bytes = bytes.clone();
    let root = root(&app)?;
    tauri::async_runtime::spawn_blocking(move || prompt_files::store_bytes(&root, &name, &bytes))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.code())
}

#[tauri::command]
pub async fn copy_prompt_file(path: String, app: AppHandle) -> Result<SavedFile, String> {
    let root = root(&app)?;
    tauri::async_runtime::spawn_blocking(move || prompt_files::store_copy(&root, Path::new(&path)))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.code())
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_what_encode_uri_component_produces() {
        assert_eq!(
            percent_decode("%E1%BA%A3nh%20ch%E1%BB%A5p.png"),
            "ảnh chụp.png"
        );
        assert_eq!(percent_decode("a%2Fb.png"), "a/b.png");
        assert_eq!(percent_decode("100%.png"), "100%.png");
        assert_eq!(percent_decode("%zz%4"), "%zz%4");
    }
}
