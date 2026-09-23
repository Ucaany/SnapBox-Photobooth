//! Command layer Tauri.
//!
//! Aturan (PRD Bab 10.10): setiap command memvalidasi input, memeriksa state
//! device, membatasi ukuran berkas, mengembalikan error bertipe, dan hanya
//! mencatat metadata yang aman. DILARANG menyediakan command yang menjalankan
//! shell atau proses arbitrer.
//!
//! Isi Fase 0 baru identitas aplikasi. `device.*` (fingerprint, secure storage
//! session) dan adapter hardware masuk di Fase 4.

pub mod app;
