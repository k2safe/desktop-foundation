use std::sync::{Arc, Mutex};

use crate::desktop::{CopyTextRequest, DesktopActionReply, NotifyRequest, OpenExternalRequest};
use crate::error::{DesktopError, DesktopResult};
use crate::file::{
    ExportJsonRequest, FileDialogReply, FilePathReply, OpenFileDialogRequest, ReadTextFileRequest,
    SaveFileDialogReply, SaveFileDialogRequest, TextFileReply, WriteBinaryFileRequest,
    WriteTextFileRequest,
};
use crate::http::{HttpRequest, HttpResponse};
use crate::proxy::ProxyConfig;
use crate::runtime::DesktopAction;
use crate::secure::{SecureStorageGetRequest, SecureStorageRemoveRequest, SecureStorageSetRequest};
use crate::session::SessionState;
use crate::storage::StorageValue;
use crate::update::{UpdateInstallReply, UpdateInstallRequest};

pub trait HttpAdapter: Send + Sync {
    fn request(
        &self,
        request: HttpRequest,
        session: Option<SessionState>,
        proxy: Option<ProxyConfig>,
    ) -> DesktopResult<HttpResponse>;
}

pub trait DesktopAdapter: Send + Sync {
    fn open_external(&self, request: OpenExternalRequest) -> DesktopResult<DesktopActionReply>;
    fn copy_text(&self, request: CopyTextRequest) -> DesktopResult<DesktopActionReply>;
    fn notify(&self, request: NotifyRequest) -> DesktopResult<DesktopActionReply>;
}

pub trait FileAdapter: Send + Sync {
    fn open_file_dialog(&self, request: OpenFileDialogRequest) -> DesktopResult<FileDialogReply>;
    fn save_file_dialog(
        &self,
        request: SaveFileDialogRequest,
    ) -> DesktopResult<SaveFileDialogReply>;
    fn read_text_file(&self, request: ReadTextFileRequest) -> DesktopResult<TextFileReply>;
    fn write_text_file(&self, request: WriteTextFileRequest) -> DesktopResult<FilePathReply>;
    fn write_binary_file(&self, request: WriteBinaryFileRequest) -> DesktopResult<FilePathReply>;
    fn export_json(&self, request: ExportJsonRequest) -> DesktopResult<FilePathReply>;
}

pub trait SecureStorageAdapter: Send + Sync {
    fn get(&self, request: SecureStorageGetRequest) -> DesktopResult<StorageValue>;
    fn set(&self, request: SecureStorageSetRequest) -> DesktopResult<StorageValue>;
    fn remove(&self, request: SecureStorageRemoveRequest) -> DesktopResult<DesktopActionReply>;
}

pub trait UpdateInstallerAdapter: Send + Sync {
    fn install_update(&self, request: UpdateInstallRequest) -> DesktopResult<UpdateInstallReply>;
}

#[derive(Default)]
pub struct NoopHttpAdapter;

impl HttpAdapter for NoopHttpAdapter {
    fn request(
        &self,
        request: HttpRequest,
        _session: Option<SessionState>,
        _proxy: Option<ProxyConfig>,
    ) -> DesktopResult<HttpResponse> {
        let mut error = DesktopError::new(
            "HTTP_TRANSPORT_NOT_CONFIGURED",
            "HTTP transport is not configured for desktop-core-rs",
        );
        if let Some(request_id) = request.request_id {
            error = error.with_request_id(request_id);
        }
        Err(error)
    }
}

#[derive(Clone)]
pub struct RecordingDesktopAdapter {
    actions: Arc<Mutex<Vec<DesktopAction>>>,
}

impl RecordingDesktopAdapter {
    pub fn new(actions: Arc<Mutex<Vec<DesktopAction>>>) -> Self {
        Self { actions }
    }
}

impl DesktopAdapter for RecordingDesktopAdapter {
    fn open_external(&self, request: OpenExternalRequest) -> DesktopResult<DesktopActionReply> {
        self.actions
            .lock()
            .map_err(|_| {
                DesktopError::new(
                    "DESKTOP_ACTION_LOCK_FAILED",
                    "Failed to lock desktop actions",
                )
            })?
            .push(DesktopAction::OpenExternal(request.url));
        Ok(DesktopActionReply { ok: true })
    }

    fn copy_text(&self, request: CopyTextRequest) -> DesktopResult<DesktopActionReply> {
        self.actions
            .lock()
            .map_err(|_| {
                DesktopError::new(
                    "DESKTOP_ACTION_LOCK_FAILED",
                    "Failed to lock desktop actions",
                )
            })?
            .push(DesktopAction::CopyText(request.text));
        Ok(DesktopActionReply { ok: true })
    }

    fn notify(&self, request: NotifyRequest) -> DesktopResult<DesktopActionReply> {
        self.actions
            .lock()
            .map_err(|_| {
                DesktopError::new(
                    "DESKTOP_ACTION_LOCK_FAILED",
                    "Failed to lock desktop actions",
                )
            })?
            .push(DesktopAction::Notify {
                title: request.title,
                body: request.body,
            });
        Ok(DesktopActionReply { ok: true })
    }
}

#[derive(Default)]
pub struct NoopFileAdapter;

impl FileAdapter for NoopFileAdapter {
    fn open_file_dialog(&self, _request: OpenFileDialogRequest) -> DesktopResult<FileDialogReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }

    fn save_file_dialog(
        &self,
        _request: SaveFileDialogRequest,
    ) -> DesktopResult<SaveFileDialogReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }

    fn read_text_file(&self, _request: ReadTextFileRequest) -> DesktopResult<TextFileReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }

    fn write_text_file(&self, _request: WriteTextFileRequest) -> DesktopResult<FilePathReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }

    fn write_binary_file(&self, _request: WriteBinaryFileRequest) -> DesktopResult<FilePathReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }

    fn export_json(&self, _request: ExportJsonRequest) -> DesktopResult<FilePathReply> {
        Err(DesktopError::new(
            "FILE_ADAPTER_NOT_CONFIGURED",
            "File adapter is not configured",
        ))
    }
}

#[derive(Default)]
pub struct NoopSecureStorageAdapter;

impl SecureStorageAdapter for NoopSecureStorageAdapter {
    fn get(&self, _request: SecureStorageGetRequest) -> DesktopResult<StorageValue> {
        Ok(StorageValue { value: None })
    }

    fn set(&self, request: SecureStorageSetRequest) -> DesktopResult<StorageValue> {
        Ok(StorageValue {
            value: Some(request.value),
        })
    }

    fn remove(&self, _request: SecureStorageRemoveRequest) -> DesktopResult<DesktopActionReply> {
        Ok(DesktopActionReply { ok: true })
    }
}

#[derive(Default)]
pub struct NoopUpdateInstallerAdapter;

impl UpdateInstallerAdapter for NoopUpdateInstallerAdapter {
    fn install_update(&self, _request: UpdateInstallRequest) -> DesktopResult<UpdateInstallReply> {
        Err(DesktopError::new(
            "UPDATE_INSTALLER_NOT_CONFIGURED",
            "Update installer adapter is not configured",
        ))
    }
}
