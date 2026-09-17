use std::io;
use thiserror::Error;

use crate::diagnostics::{sanitize_text, sanitize_url};

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Json deserialization error: {0}, object type: {1}, context: {2}")]
    JsonDeserialize(serde_json::Error, String, String),
    #[error("Json parse error: {0}")]
    JsonParse(#[from] serde_json::Error),
    #[error("I/O error: {0}")]
    IO(#[from] io::Error),
    #[error("Excel error: {0}")]
    Excel(#[from] rust_xlsxwriter::XlsxError),
    #[error("Base64 decode error: {0}")]
    Base64Decode(#[from] base64::DecodeError),
    #[error("To string error: {0}")]
    ToStrError(#[from] reqwest::header::ToStrError),
    #[error("Login error")]
    LoginError,
    #[error("JBox error: {0}")]
    JBoxError(String),
    #[error("Function unsupported")]
    #[allow(dead_code)]
    FunctionUnsupported,
    #[error("Submission upload error: {0}")]
    SubmissionUpload(String),
    #[error("Join error: {0}")]
    JoinError(#[from] tokio::task::JoinError),
    #[error("QRCode Image error: {0}")]
    QRCodeImage(#[from] image::ImageError),
    #[error("Account already exists")]
    AccountAlreadyExists,
    #[error("Account not exists")]
    AccountNotExists,
    #[error("Not allowed to delete default account")]
    NotAllowedToDeleteDefaultAccount,
    #[error("Not allowed to create default account")]
    NotAllowedToCreateDefaultAccount,
    #[error("Mutex error")]
    MutexError,
    #[error("Failed to open stdout")]
    OpenStdoutError,
    #[error("Failed to open stderr")]
    OpenStderrError,
    #[error("Failed to download video {0}")]
    VideoDownloadError(String),
    #[error("Unsupported file extension {0}")]
    UnsupportedFileExtensionError(String),
    #[error("PDF extract output error: {0}")]
    PDFOutputError(#[from] pdf_extract::OutputError),
    #[error("Docx reader error: {0}")]
    DocxReaderError(#[from] docx_rs::ReaderError),
    #[error("LLM error: {0}")]
    LLMError(String),
    #[error("Attendance error: {0}")]
    AttendanceError(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Network(_) => "BACKEND.NETWORK",
            Self::JsonDeserialize(_, _, _) => "BACKEND.JSON_DESERIALIZE",
            Self::JsonParse(_) => "BACKEND.JSON_PARSE",
            Self::IO(_) => "BACKEND.IO",
            Self::Excel(_) => "BACKEND.EXCEL",
            Self::Base64Decode(_) => "BACKEND.BASE64_DECODE",
            Self::ToStrError(_) => "BACKEND.HEADER_TO_STRING",
            Self::LoginError => "AUTH.LOGIN_REQUIRED",
            Self::JBoxError(_) => "JBOX.OPERATION_FAILED",
            Self::FunctionUnsupported => "PLATFORM.UNSUPPORTED",
            Self::SubmissionUpload(_) => "SUBMISSION.UPLOAD_FAILED",
            Self::JoinError(_) => "BACKEND.TASK_JOIN",
            Self::QRCodeImage(_) => "QRCODE.IMAGE_DECODE",
            Self::AccountAlreadyExists => "ACCOUNT.ALREADY_EXISTS",
            Self::AccountNotExists => "ACCOUNT.NOT_FOUND",
            Self::NotAllowedToDeleteDefaultAccount => "ACCOUNT.DEFAULT_DELETE_FORBIDDEN",
            Self::NotAllowedToCreateDefaultAccount => "ACCOUNT.DEFAULT_CREATE_FORBIDDEN",
            Self::MutexError => "BACKEND.LOCK_POISONED",
            Self::OpenStdoutError => "PROCESS.STDOUT_UNAVAILABLE",
            Self::OpenStderrError => "PROCESS.STDERR_UNAVAILABLE",
            Self::VideoDownloadError(_) => "VIDEO.OPERATION_FAILED",
            Self::UnsupportedFileExtensionError(_) => "FILE.UNSUPPORTED_EXTENSION",
            Self::PDFOutputError(_) => "FILE.PDF_EXTRACT_FAILED",
            Self::DocxReaderError(_) => "FILE.DOCX_READ_FAILED",
            Self::LLMError(_) => "LLM.OPERATION_FAILED",
            Self::AttendanceError(_) => "ATTENDANCE.OPERATION_FAILED",
        }
    }

    pub fn recoverable(&self) -> bool {
        !matches!(
            self,
            Self::MutexError | Self::OpenStdoutError | Self::OpenStderrError | Self::JoinError(_)
        )
    }

    fn expected_user_error(&self) -> bool {
        matches!(
            self,
            Self::LoginError
                | Self::AccountAlreadyExists
                | Self::AccountNotExists
                | Self::NotAllowedToDeleteDefaultAccount
                | Self::NotAllowedToCreateDefaultAccount
                | Self::FunctionUnsupported
                | Self::UnsupportedFileExtensionError(_)
        )
    }

    fn diagnostic_detail(&self) -> String {
        match self {
            Self::Network(error) => format!(
                "status={:?}, timeout={}, connect={}, url={}",
                error.status().map(|status| status.as_u16()),
                error.is_timeout(),
                error.is_connect(),
                error
                    .url()
                    .map(sanitize_url)
                    .unwrap_or_else(|| "<missing>".to_owned())
            ),
            Self::JsonDeserialize(error, object_type, _) => format!(
                "error={}, object_type={}, context=<omitted>",
                sanitize_text(&error.to_string()),
                sanitize_text(object_type)
            ),
            Self::IO(error) => format!(
                "kind={:?}, error={}",
                error.kind(),
                sanitize_text(&error.to_string())
            ),
            _ => sanitize_text(&self.to_string()),
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        let code = self.code();
        let recoverable = self.recoverable();
        let detail = self.diagnostic_detail();
        if self.expected_user_error() {
            tracing::warn!(
                target: "app_error",
                code,
                recoverable,
                %detail,
                "Application command returned an expected error"
            );
        } else {
            tracing::error!(
                target: "app_error",
                code,
                recoverable,
                %detail,
                "Application command failed"
            );
        }
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
