//! Command identitas aplikasi.
//!
//! Dipakai layar boot dan tab Sistem pada Konsol Perangkat untuk menampilkan
//! versi yang benar-benar berjalan, bukan versi yang di-hardcode di frontend.

use serde::Serialize;

use crate::error::CommandResult;

/// Informasi aplikasi yang aman dibagikan ke frontend.
#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    /// Versi dari `Cargo.toml`, sumber kebenaran tunggal.
    pub version: String,
    /// Platform target saat kompilasi: `windows`, `linux`, atau `macos`.
    pub platform: String,
    /// Arsitektur target, mis. `x86_64`.
    pub arch: String,
    /// Apakah build ini membawa debug assertion.
    pub debug: bool,
}

/// Mengembalikan identitas aplikasi yang sedang berjalan.
#[tauri::command]
pub fn get_app_info() -> CommandResult<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        debug: cfg!(debug_assertions),
    })
}
