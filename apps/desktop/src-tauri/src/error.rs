//! Tipe error terstruktur untuk seluruh command Tauri.
//!
//! PRD Bab 10.10 mewajibkan setiap command mengembalikan error bertipe, bukan
//! string bebas. Frontend memakai `code` untuk bercabang, `message` untuk
//! ditampilkan, dan `retryable` untuk memutuskan tombol "Coba lagi".
//!
//! `developer_message` boleh memuat detail teknis, tetapi `message` DILARANG
//! memuat path sistem, kredensial, atau token device.

use serde::Serialize;

/// Kode error lintas command. Tambahkan varian di sini, jangan pakai string literal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// Input command tidak lolos validasi.
    InvalidInput,
    /// Operasi butuh state yang belum terpenuhi (mis. device belum dipairing).
    InvalidState,
    /// Akses ke penyimpanan aman OS gagal.
    SecureStorageFailure,
    /// Path ditolak karena di luar direktori yang diizinkan (PRD Bab 10.11).
    PathNotAllowed,
    /// Resource tidak ditemukan.
    NotFound,
    /// Operasi tidak diizinkan pada state saat ini.
    Forbidden,
    /// Kegagalan tak terduga.
    Internal,
}

/// Error yang dikembalikan command Tauri ke frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    /// Kode mesin untuk percabangan di frontend.
    pub code: ErrorCode,
    /// Pesan aman untuk ditampilkan ke operator.
    pub message: String,
    /// Apakah operasi masuk akal untuk dicoba ulang.
    pub retryable: bool,
    /// Detail teknis. Opsional, dan tidak boleh memuat secret.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer_message: Option<String>,
}

impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
            developer_message: None,
        }
    }

    /// Melampirkan detail teknis tanpa mengubah pesan yang dilihat pengguna.
    pub fn with_developer_message(mut self, detail: impl Into<String>) -> Self {
        self.developer_message = Some(detail.into());
        self
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidInput, message, false)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message, false)
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

/// Alias hasil yang dipakai semua command.
pub type CommandResult<T> = Result<T, CommandError>;
