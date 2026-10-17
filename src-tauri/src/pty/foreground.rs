#[cfg(unix)]
use std::os::fd::OwnedFd;

/// Reads what a session's terminal runs in the foreground, from any thread.
pub struct ForegroundProbe {
    /// A dup of the PTY master: the session itself lives on its `QueuedProcess` worker.
    #[cfg(unix)]
    master: OwnedFd,
    /// The child's pid; on Unix also its process group, as it is a session leader.
    pid: u32,
}

impl ForegroundProbe {
    #[cfg(unix)]
    pub(super) fn new(master: OwnedFd, pid: u32) -> Self {
        ForegroundProbe { master, pid }
    }

    #[cfg(windows)]
    pub(super) fn new(pid: u32) -> Self {
        ForegroundProbe { pid }
    }

    /// None while the child itself is in the foreground; otherwise the argv of what runs
    /// there, empty when it cannot be read.
    #[cfg(unix)]
    pub fn foreground_argv(&self) -> Option<Vec<String>> {
        use std::os::fd::AsRawFd;
        let group = unsafe { libc::tcgetpgrp(self.master.as_raw_fd()) };
        if group <= 0 || group as u32 == self.pid {
            return None;
        }
        Some(process_argv(group).unwrap_or_default())
    }

    /// Only the program name is known on Windows.
    #[cfg(windows)]
    pub fn foreground_argv(&self) -> Option<Vec<String>> {
        child_exe(self.pid).map(|exe| vec![exe])
    }
}

/// argv of a process via `KERN_PROCARGS2`: argc as an i32, the exec path, NUL padding,
/// then argc NUL-terminated arguments.
#[cfg(target_os = "macos")]
fn process_argv(pid: libc::pid_t) -> Option<Vec<String>> {
    use std::ptr::null_mut;
    let mut argmax: libc::c_int = 0;
    let mut size = std::mem::size_of::<libc::c_int>();
    let mut mib = [libc::CTL_KERN, libc::KERN_ARGMAX];
    let rc = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            2,
            (&mut argmax as *mut libc::c_int).cast(),
            &mut size,
            null_mut(),
            0,
        )
    };
    if rc != 0 || argmax <= 0 {
        return None;
    }
    let mut buf = vec![0u8; argmax as usize];
    let mut size = buf.len();
    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid];
    let rc = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            buf.as_mut_ptr().cast(),
            &mut size,
            null_mut(),
            0,
        )
    };
    if rc != 0 {
        return None;
    }
    buf.truncate(size);

    let argc = i32::from_ne_bytes(buf.get(..4)?.try_into().ok()?);
    let rest = &buf[4..];
    let exec_path_end = rest.iter().position(|&b| b == 0)?;
    let rest = &rest[exec_path_end..];
    let args_start = rest.iter().position(|&b| b != 0)?;
    let argv: Vec<String> = rest[args_start..]
        .split(|&b| b == 0)
        .take(argc.max(0) as usize)
        .map(|arg| String::from_utf8_lossy(arg).into_owned())
        .collect();
    Some(argv)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn process_argv(_pid: libc::pid_t) -> Option<Vec<String>> {
    None
}

/// The exe name of a child of `parent`; the last one in the snapshot when there are several.
#[cfg(windows)]
fn child_exe(parent: u32) -> Option<String> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return None;
    }
    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
    let mut found = None;
    let mut more = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while more {
        if entry.th32ParentProcessID == parent {
            let len = entry
                .szExeFile
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szExeFile.len());
            found = Some(String::from_utf16_lossy(&entry.szExeFile[..len]));
        }
        more = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe { CloseHandle(snapshot) };
    found
}
