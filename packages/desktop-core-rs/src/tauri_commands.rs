use tauri::State;

use crate::desktop::{CopyTextRequest, DesktopActionReply, NotifyRequest, OpenExternalRequest};
use crate::error::DesktopError;
use crate::file::{
    DownloadFileReply, DownloadFileRequest, ExportJsonRequest, FileDialogReply, FilePathReply,
    OpenFileDialogRequest, ReadTextFileRequest, SaveFileDialogReply, SaveFileDialogRequest, TextFileReply,
    WriteTextFileRequest,
};
use crate::http::{HttpRequest, HttpResponse};
use crate::runtime::DesktopCore;
use crate::secure::{SecureStorageGetRequest, SecureStorageRemoveRequest, SecureStorageSetRequest};
use crate::session::{SessionClearRequest, SessionGetRequest, SessionSetRequest, SessionState};
use crate::storage::{StorageGetRequest, StorageRemoveRequest, StorageSetRequest, StorageValue};
use crate::window::{WindowSetStateRequest, WindowSetTitleRequest, WindowState};

#[tauri::command]
pub async fn df_http_request(core: State<'_, DesktopCore>, request: HttpRequest) -> Result<HttpResponse, DesktopError> {
    let core = core.inner().clone();
    tauri::async_runtime::spawn_blocking(move || core.http_request(request))
        .await
        .map_err(|error| DesktopError::new("HTTP_TASK_FAILED", "HTTP task failed").with_details(serde_json::Value::String(error.to_string())))?
}

#[tauri::command]
pub async fn df_session_get(core: State<'_, DesktopCore>, request: SessionGetRequest) -> Result<SessionState, DesktopError> {
    core.session_get(request)
}

#[tauri::command]
pub async fn df_session_set(core: State<'_, DesktopCore>, request: SessionSetRequest) -> Result<SessionState, DesktopError> {
    core.session_set(request)
}

#[tauri::command]
pub async fn df_session_clear(core: State<'_, DesktopCore>, request: SessionClearRequest) -> Result<DesktopActionReply, DesktopError> {
    core.session_clear(request)
}

#[tauri::command]
pub async fn df_storage_get(core: State<'_, DesktopCore>, request: StorageGetRequest) -> Result<StorageValue, DesktopError> {
    core.storage_get(request)
}

#[tauri::command]
pub async fn df_storage_set(core: State<'_, DesktopCore>, request: StorageSetRequest) -> Result<StorageValue, DesktopError> {
    core.storage_set(request)
}

#[tauri::command]
pub async fn df_storage_remove(core: State<'_, DesktopCore>, request: StorageRemoveRequest) -> Result<DesktopActionReply, DesktopError> {
    core.storage_remove(request)
}

#[tauri::command]
pub async fn df_open_external(core: State<'_, DesktopCore>, request: OpenExternalRequest) -> Result<DesktopActionReply, DesktopError> {
    core.open_external(request)
}

#[tauri::command]
pub async fn df_copy_text(core: State<'_, DesktopCore>, request: CopyTextRequest) -> Result<DesktopActionReply, DesktopError> {
    core.copy_text(request)
}

#[tauri::command]
pub async fn df_notify(core: State<'_, DesktopCore>, request: NotifyRequest) -> Result<DesktopActionReply, DesktopError> {
    core.notify(request)
}

#[tauri::command]
pub async fn df_file_open_dialog(core: State<'_, DesktopCore>, request: OpenFileDialogRequest) -> Result<FileDialogReply, DesktopError> {
    core.open_file_dialog(request)
}

#[tauri::command]
pub async fn df_file_save_dialog(core: State<'_, DesktopCore>, request: SaveFileDialogRequest) -> Result<SaveFileDialogReply, DesktopError> {
    core.save_file_dialog(request)
}

#[tauri::command]
pub async fn df_file_read_text(core: State<'_, DesktopCore>, request: ReadTextFileRequest) -> Result<TextFileReply, DesktopError> {
    core.read_text_file(request)
}

#[tauri::command]
pub async fn df_file_write_text(core: State<'_, DesktopCore>, request: WriteTextFileRequest) -> Result<FilePathReply, DesktopError> {
    core.write_text_file(request)
}

#[tauri::command]
pub async fn df_file_export_json(core: State<'_, DesktopCore>, request: ExportJsonRequest) -> Result<FilePathReply, DesktopError> {
    core.export_json(request)
}

#[tauri::command]
pub async fn df_file_download(core: State<'_, DesktopCore>, request: DownloadFileRequest) -> Result<DownloadFileReply, DesktopError> {
    let core = core.inner().clone();
    tauri::async_runtime::spawn_blocking(move || core.download_file(request))
        .await
        .map_err(|error| DesktopError::new("DOWNLOAD_TASK_FAILED", "Download task failed").with_details(serde_json::Value::String(error.to_string())))?
}

#[tauri::command]
pub async fn df_secure_storage_get(core: State<'_, DesktopCore>, request: SecureStorageGetRequest) -> Result<StorageValue, DesktopError> {
    core.secure_storage_get(request)
}

#[tauri::command]
pub async fn df_secure_storage_set(core: State<'_, DesktopCore>, request: SecureStorageSetRequest) -> Result<StorageValue, DesktopError> {
    core.secure_storage_set(request)
}

#[tauri::command]
pub async fn df_secure_storage_remove(core: State<'_, DesktopCore>, request: SecureStorageRemoveRequest) -> Result<DesktopActionReply, DesktopError> {
    core.secure_storage_remove(request)
}

#[tauri::command]
pub async fn df_window_get_state(window: tauri::Window) -> Result<WindowState, DesktopError> {
    let position = window
        .outer_position()
        .map_err(|error| DesktopError::new("WINDOW_POSITION_FAILED", "Failed to read window position").with_details(serde_json::Value::String(error.to_string())))?;
    let size = window
        .outer_size()
        .map_err(|error| DesktopError::new("WINDOW_SIZE_FAILED", "Failed to read window size").with_details(serde_json::Value::String(error.to_string())))?;
    let maximized = window
        .is_maximized()
        .map_err(|error| DesktopError::new("WINDOW_MAXIMIZED_FAILED", "Failed to read maximized state").with_details(serde_json::Value::String(error.to_string())))?;
    let fullscreen = window
        .is_fullscreen()
        .map_err(|error| DesktopError::new("WINDOW_FULLSCREEN_FAILED", "Failed to read fullscreen state").with_details(serde_json::Value::String(error.to_string())))?;
    Ok(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
        fullscreen,
    })
}

#[tauri::command]
pub async fn df_window_set_state(window: tauri::Window, request: WindowSetStateRequest) -> Result<DesktopActionReply, DesktopError> {
    if let (Some(width), Some(height)) = (request.width, request.height) {
        window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
            .map_err(|error| DesktopError::new("WINDOW_SET_SIZE_FAILED", "Failed to set window size").with_details(serde_json::Value::String(error.to_string())))?;
    }
    if let (Some(x), Some(y)) = (request.x, request.y) {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|error| DesktopError::new("WINDOW_SET_POSITION_FAILED", "Failed to set window position").with_details(serde_json::Value::String(error.to_string())))?;
    }
    if let Some(maximized) = request.maximized {
        if maximized {
            window
                .maximize()
                .map_err(|error| DesktopError::new("WINDOW_MAXIMIZE_FAILED", "Failed to maximize window").with_details(serde_json::Value::String(error.to_string())))?;
        } else {
            window
                .unmaximize()
                .map_err(|error| DesktopError::new("WINDOW_UNMAXIMIZE_FAILED", "Failed to unmaximize window").with_details(serde_json::Value::String(error.to_string())))?;
        }
    }
    if let Some(fullscreen) = request.fullscreen {
        window
            .set_fullscreen(fullscreen)
            .map_err(|error| DesktopError::new("WINDOW_FULLSCREEN_FAILED", "Failed to set fullscreen state").with_details(serde_json::Value::String(error.to_string())))?;
    }
    Ok(DesktopActionReply { ok: true })
}

#[tauri::command]
pub async fn df_window_set_title(window: tauri::Window, request: WindowSetTitleRequest) -> Result<DesktopActionReply, DesktopError> {
    window
        .set_title(&request.title)
        .map_err(|error| DesktopError::new("WINDOW_SET_TITLE_FAILED", "Failed to set window title").with_details(serde_json::Value::String(error.to_string())))?;
    Ok(DesktopActionReply { ok: true })
}

pub fn desktop_core_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("desktop-core")
        .invoke_handler(tauri::generate_handler![
            df_http_request,
            df_session_get,
            df_session_set,
            df_session_clear,
            df_storage_get,
            df_storage_set,
            df_storage_remove,
            df_open_external,
            df_copy_text,
            df_notify,
            df_file_open_dialog,
            df_file_save_dialog,
            df_file_read_text,
            df_file_write_text,
            df_file_export_json,
            df_file_download,
            df_secure_storage_get,
            df_secure_storage_set,
            df_secure_storage_remove,
            df_window_get_state,
            df_window_set_state,
            df_window_set_title
        ])
        .build()
}
