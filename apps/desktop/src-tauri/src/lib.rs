//! SnapBox Desktop Kiosk: entry point library.
//!
//! Fase 0 hanya menyiapkan kerangka: command layer, tipe error, dan konfigurasi
//! window. Single-instance lock, secure storage, adapter kamera/printer, dan
//! state machine sesi menyusul di Fase 4 dan 5.
//!
//! ADR-016 menetapkan single instance wajib; itu ditambahkan bersama modul
//! `device` di Fase 4 karena lock tersebut harus hidup selama proses berjalan,
//! bukan per-window.

pub mod commands;
pub mod error;

/// Menjalankan aplikasi kiosk.
///
/// # Panics
/// Panik bila runtime Tauri gagal start. Kiosk tidak punya jalur pemulihan yang
/// berarti tanpa webview, jadi kegagalan di sini harus terlihat, bukan ditelan.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::app::get_app_info])
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi Tauri SnapBox");
}
