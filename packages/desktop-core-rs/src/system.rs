use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose;
use base64::Engine as _;
use serde_json::Value;

use crate::adapters::{DesktopAdapter, FileAdapter, SecureStorageAdapter, UpdateInstallerAdapter};
use crate::desktop::{CopyTextRequest, DesktopActionReply, NotifyRequest, OpenExternalRequest};
use crate::error::{DesktopError, DesktopResult};
use crate::file::{
    ExportJsonRequest, FileDialogReply, FilePathReply, OpenFileDialogRequest, ReadTextFileRequest,
    SaveFileDialogReply, SaveFileDialogRequest, TextFileReply, WriteBinaryFileRequest,
    WriteTextFileRequest,
};
use crate::secure::{SecureStorageGetRequest, SecureStorageRemoveRequest, SecureStorageSetRequest};
use crate::storage::StorageValue;
use crate::update::{UpdateInstallReply, UpdateInstallRequest};

#[derive(Default)]
pub struct SystemDesktopAdapter;

impl DesktopAdapter for SystemDesktopAdapter {
    fn open_external(&self, request: OpenExternalRequest) -> DesktopResult<DesktopActionReply> {
        open_external(&request.url)?;
        Ok(DesktopActionReply { ok: true })
    }

    fn copy_text(&self, request: CopyTextRequest) -> DesktopResult<DesktopActionReply> {
        copy_text(&request.text)?;
        Ok(DesktopActionReply { ok: true })
    }

    fn notify(&self, request: NotifyRequest) -> DesktopResult<DesktopActionReply> {
        notify(&request.title, request.body.as_deref())?;
        Ok(DesktopActionReply { ok: true })
    }
}

#[derive(Clone)]
pub struct SystemFileAdapter {
    app_id: String,
}

impl SystemFileAdapter {
    pub fn new(app_id: impl Into<String>) -> Self {
        Self {
            app_id: app_id.into(),
        }
    }

    fn default_export_dir(&self) -> DesktopResult<PathBuf> {
        dirs::download_dir()
            .or_else(dirs::document_dir)
            .or_else(dirs::data_dir)
            .map(|base| {
                base.join("desktop-foundation")
                    .join(sanitize_path_segment(&self.app_id))
                    .join("exports")
            })
            .ok_or_else(|| {
                DesktopError::new(
                    "EXPORT_DIR_UNAVAILABLE",
                    "Unable to resolve an export directory",
                )
            })
    }

    fn export_path(&self, directory: Option<String>, file_name: &str) -> DesktopResult<PathBuf> {
        let base = directory
            .map(PathBuf::from)
            .map(Ok)
            .unwrap_or_else(|| self.default_export_dir())?;
        Ok(base.join(sanitize_file_name(file_name)))
    }
}

impl FileAdapter for SystemFileAdapter {
    fn open_file_dialog(&self, request: OpenFileDialogRequest) -> DesktopResult<FileDialogReply> {
        open_file_dialog(request)
    }

    fn save_file_dialog(
        &self,
        request: SaveFileDialogRequest,
    ) -> DesktopResult<SaveFileDialogReply> {
        save_file_dialog(request)
    }

    fn read_text_file(&self, request: ReadTextFileRequest) -> DesktopResult<TextFileReply> {
        let content = fs::read_to_string(&request.path).map_err(|error| {
            DesktopError::new("FILE_READ_FAILED", "Failed to read text file")
                .with_details(Value::String(error.to_string()))
        })?;
        Ok(TextFileReply {
            path: request.path,
            content,
        })
    }

    fn write_text_file(&self, request: WriteTextFileRequest) -> DesktopResult<FilePathReply> {
        let path = PathBuf::from(&request.path);
        if request.create_dir {
            ensure_parent_dir(&path)?;
        }
        fs::write(&path, request.content).map_err(|error| {
            DesktopError::new("FILE_WRITE_FAILED", "Failed to write text file")
                .with_details(Value::String(error.to_string()))
        })?;
        Ok(FilePathReply {
            path: path_to_string(path),
            ok: true,
        })
    }

    fn write_binary_file(&self, request: WriteBinaryFileRequest) -> DesktopResult<FilePathReply> {
        let bytes = general_purpose::STANDARD
            .decode(request.content_base64)
            .map_err(|error| {
                DesktopError::new("FILE_BASE64_DECODE_FAILED", "Failed to decode file content")
                    .with_details(Value::String(error.to_string()))
            })?;
        let path = PathBuf::from(&request.path);
        if request.create_dir {
            ensure_parent_dir(&path)?;
        }
        fs::write(&path, bytes).map_err(|error| {
            DesktopError::new("FILE_WRITE_FAILED", "Failed to write binary file")
                .with_details(Value::String(error.to_string()))
        })?;
        Ok(FilePathReply {
            path: path_to_string(path),
            ok: true,
        })
    }

    fn export_json(&self, request: ExportJsonRequest) -> DesktopResult<FilePathReply> {
        let path = self.export_path(
            request.directory,
            &ensure_extension(&request.file_name, "json"),
        )?;
        ensure_parent_dir(&path)?;
        let content = serde_json::to_string_pretty(&request.data).map_err(|error| {
            DesktopError::new(
                "EXPORT_JSON_SERIALIZE_FAILED",
                "Failed to serialize JSON export",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        fs::write(&path, content).map_err(|error| {
            DesktopError::new("EXPORT_JSON_WRITE_FAILED", "Failed to write JSON export")
                .with_details(Value::String(error.to_string()))
        })?;
        Ok(FilePathReply {
            path: path_to_string(path),
            ok: true,
        })
    }
}

#[derive(Clone)]
pub struct FileSecureStorageAdapter {
    root: PathBuf,
}

impl FileSecureStorageAdapter {
    pub fn new(app_id: impl AsRef<str>) -> DesktopResult<Self> {
        let root = dirs::data_dir()
            .map(|base| {
                base.join("desktop-foundation")
                    .join(sanitize_path_segment(app_id.as_ref()))
                    .join("secure")
            })
            .ok_or_else(|| {
                DesktopError::new(
                    "SECURE_FALLBACK_DIR_UNAVAILABLE",
                    "Unable to resolve secure fallback directory",
                )
            })?;
        Ok(Self { root })
    }

    pub fn with_root(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    fn path_for(&self, namespace: &str, key: &str) -> PathBuf {
        self.root
            .join(sanitize_path_segment(namespace))
            .join(format!("{}.json", sanitize_path_segment(key)))
    }
}

impl SecureStorageAdapter for FileSecureStorageAdapter {
    fn get(&self, request: SecureStorageGetRequest) -> DesktopResult<StorageValue> {
        let path = self.path_for(&request.namespace, &request.key);
        if !path.exists() {
            return Ok(StorageValue { value: None });
        }
        let content = fs::read_to_string(&path).map_err(|error| {
            DesktopError::new(
                "SECURE_FALLBACK_READ_FAILED",
                "Failed to read secure fallback value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        let value = serde_json::from_str::<Value>(&content).map_err(|error| {
            DesktopError::new(
                "SECURE_FALLBACK_PARSE_FAILED",
                "Failed to parse secure fallback value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        Ok(StorageValue { value: Some(value) })
    }

    fn set(&self, request: SecureStorageSetRequest) -> DesktopResult<StorageValue> {
        let path = self.path_for(&request.namespace, &request.key);
        ensure_parent_dir(&path)?;
        let content = serde_json::to_string(&request.value).map_err(|error| {
            DesktopError::new(
                "SECURE_FALLBACK_SERIALIZE_FAILED",
                "Failed to serialize secure fallback value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        fs::write(&path, content).map_err(|error| {
            DesktopError::new(
                "SECURE_FALLBACK_WRITE_FAILED",
                "Failed to write secure fallback value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        Ok(StorageValue {
            value: Some(request.value),
        })
    }

    fn remove(&self, request: SecureStorageRemoveRequest) -> DesktopResult<DesktopActionReply> {
        let path = self.path_for(&request.namespace, &request.key);
        if path.exists() {
            fs::remove_file(path).map_err(|error| {
                DesktopError::new(
                    "SECURE_FALLBACK_REMOVE_FAILED",
                    "Failed to remove secure fallback value",
                )
                .with_details(Value::String(error.to_string()))
            })?;
        }
        Ok(DesktopActionReply { ok: true })
    }
}

#[derive(Clone)]
pub struct SystemSecureStorageAdapter {
    app_id: String,
    fallback: FileSecureStorageAdapter,
}

impl SystemSecureStorageAdapter {
    pub fn new(app_id: impl Into<String>) -> DesktopResult<Self> {
        let app_id = app_id.into();
        Ok(Self {
            fallback: FileSecureStorageAdapter::new(&app_id)?,
            app_id,
        })
    }

    fn service(&self, namespace: &str) -> String {
        format!(
            "desktop-foundation.{}.{}",
            sanitize_path_segment(&self.app_id),
            sanitize_path_segment(namespace)
        )
    }
}

impl SecureStorageAdapter for SystemSecureStorageAdapter {
    fn get(&self, request: SecureStorageGetRequest) -> DesktopResult<StorageValue> {
        match platform_secure_get(&self.service(&request.namespace), &request.key) {
            Ok(Some(value)) => {
                let parsed = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
                Ok(StorageValue {
                    value: Some(parsed),
                })
            }
            Ok(None) => self.fallback.get(request),
            Err(error) if error.code == "SECURE_PLATFORM_UNAVAILABLE" => self.fallback.get(request),
            Err(error) => Err(error),
        }
    }

    fn set(&self, request: SecureStorageSetRequest) -> DesktopResult<StorageValue> {
        let serialized = serde_json::to_string(&request.value).map_err(|error| {
            DesktopError::new(
                "SECURE_STORAGE_SERIALIZE_FAILED",
                "Failed to serialize secure value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        match platform_secure_set(&self.service(&request.namespace), &request.key, &serialized) {
            Ok(()) => Ok(StorageValue {
                value: Some(request.value),
            }),
            Err(error) if error.code == "SECURE_PLATFORM_UNAVAILABLE" => self.fallback.set(request),
            Err(error) => Err(error),
        }
    }

    fn remove(&self, request: SecureStorageRemoveRequest) -> DesktopResult<DesktopActionReply> {
        match platform_secure_remove(&self.service(&request.namespace), &request.key) {
            Ok(()) => Ok(DesktopActionReply { ok: true }),
            Err(error) if error.code == "SECURE_VALUE_NOT_FOUND" => {
                Ok(DesktopActionReply { ok: true })
            }
            Err(error) if error.code == "SECURE_PLATFORM_UNAVAILABLE" => {
                self.fallback.remove(request)
            }
            Err(error) => Err(error),
        }
    }
}

#[derive(Clone)]
pub struct SystemUpdateInstallerAdapter {
    app_id: String,
}

impl SystemUpdateInstallerAdapter {
    pub fn new(app_id: impl Into<String>) -> Self {
        Self {
            app_id: app_id.into(),
        }
    }

    fn staging_root(&self) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default();
        std::env::temp_dir()
            .join("desktop-foundation")
            .join(sanitize_path_segment(&self.app_id))
            .join("updates")
            .join(format!("{}-{}", timestamp, std::process::id()))
    }
}

impl UpdateInstallerAdapter for SystemUpdateInstallerAdapter {
    fn install_update(&self, request: UpdateInstallRequest) -> DesktopResult<UpdateInstallReply> {
        install_update_package(request, self.staging_root())
    }
}

fn install_update_package(
    request: UpdateInstallRequest,
    staging_root: PathBuf,
) -> DesktopResult<UpdateInstallReply> {
    #[cfg(target_os = "macos")]
    {
        return macos_install_update(request, staging_root);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = staging_root;
        open_update_package(request)
    }
}

#[cfg(target_os = "macos")]
fn macos_install_update(
    request: UpdateInstallRequest,
    staging_root: PathBuf,
) -> DesktopResult<UpdateInstallReply> {
    let package_path = PathBuf::from(&request.path);
    if !package_path.exists() {
        return Err(
            DesktopError::new("UPDATE_PACKAGE_NOT_FOUND", "Update package was not found")
                .with_details(Value::String(request.path)),
        );
    }

    if has_extension(&package_path, "zip") {
        let source_app = stage_zip_app(&package_path, &staging_root)?;
        return stage_app_replacement(&request, &source_app, &staging_root);
    }

    if is_app_bundle(&package_path) {
        let source_app = stage_app_bundle(&package_path, &staging_root)?;
        return stage_app_replacement(&request, &source_app, &staging_root);
    }

    open_update_package(request)
}

#[cfg(target_os = "macos")]
fn stage_app_replacement(
    request: &UpdateInstallRequest,
    source_app: &Path,
    staging_root: &Path,
) -> DesktopResult<UpdateInstallReply> {
    let target_app = target_app_path(source_app, request);
    let source_app = source_app.canonicalize().map_err(|error| {
        DesktopError::new(
            "UPDATE_SOURCE_RESOLVE_FAILED",
            "Failed to resolve staged update app",
        )
        .with_details(Value::String(error.to_string()))
    })?;
    if target_app.exists() {
        if let (Ok(source), Ok(target)) = (source_app.canonicalize(), target_app.canonicalize()) {
            if source == target {
                return Err(DesktopError::new(
                    "UPDATE_TARGET_MATCHES_SOURCE",
                    "Update source app and target app must be different",
                ));
            }
        }
    }

    let script_path = staging_root.join("install-update.sh");
    spawn_macos_replace_script(
        &script_path,
        &source_app,
        &target_app,
        staging_root,
        request.relaunch,
        request.backup,
    )?;

    Ok(UpdateInstallReply {
        status: "installing".to_string(),
        message: "Update installer is staged. Quit the app to replace it and relaunch.".to_string(),
        path: Some(path_to_string(source_app)),
        target_path: Some(path_to_string(target_app)),
        relaunch_required: true,
    })
}

#[cfg(target_os = "macos")]
fn stage_zip_app(archive: &Path, staging_root: &Path) -> DesktopResult<PathBuf> {
    fs::create_dir_all(staging_root).map_err(|error| {
        DesktopError::new(
            "UPDATE_STAGING_DIR_FAILED",
            "Failed to create update staging directory",
        )
        .with_details(Value::String(error.to_string()))
    })?;
    let mut command = Command::new("/usr/bin/ditto");
    command.args(["-x", "-k"]).arg(archive).arg(staging_root);
    run_status(
        &mut command,
        "UPDATE_ZIP_EXTRACT_FAILED",
        "Failed to extract update zip package",
    )?;
    find_app_bundle(staging_root).ok_or_else(|| {
        DesktopError::new(
            "UPDATE_APP_BUNDLE_NOT_FOUND",
            "Update zip did not contain an app bundle",
        )
        .with_details(Value::String(archive.to_string_lossy().to_string()))
    })
}

#[cfg(target_os = "macos")]
fn stage_app_bundle(source_app: &Path, staging_root: &Path) -> DesktopResult<PathBuf> {
    let file_name = source_app.file_name().ok_or_else(|| {
        DesktopError::new(
            "UPDATE_APP_NAME_MISSING",
            "Update app bundle name is missing",
        )
    })?;
    let staged_app = staging_root.join(file_name);
    ensure_parent_dir(&staged_app)?;
    let mut command = Command::new("/usr/bin/ditto");
    command.arg(source_app).arg(&staged_app);
    run_status(
        &mut command,
        "UPDATE_APP_STAGE_FAILED",
        "Failed to stage update app bundle",
    )?;
    Ok(staged_app)
}

#[cfg(target_os = "macos")]
fn target_app_path(source_app: &Path, request: &UpdateInstallRequest) -> PathBuf {
    let source_name = source_app
        .file_name()
        .and_then(|value| value.to_str())
        .map(ToString::to_string)
        .or_else(|| request.app_name.as_deref().map(app_bundle_name))
        .unwrap_or_else(|| "DesktopFoundation.app".to_string());

    if let Some(target_path) = request
        .target_path
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        let target = PathBuf::from(target_path);
        return if has_extension(&target, "app") {
            target
        } else {
            target.join(source_name)
        };
    }

    current_app_bundle().unwrap_or_else(|| {
        let app_name = request
            .app_name
            .as_deref()
            .map(app_bundle_name)
            .unwrap_or(source_name);
        PathBuf::from("/Applications").join(app_name)
    })
}

#[cfg(target_os = "macos")]
fn current_app_bundle() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .find(|path| has_extension(path, "app"))
        .map(Path::to_path_buf)
}

#[cfg(target_os = "macos")]
fn find_app_bundle(root: &Path) -> Option<PathBuf> {
    if is_app_bundle(root) {
        return Some(root.to_path_buf());
    }
    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if is_app_bundle(&path) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_app_bundle(&path) {
                return Some(found);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn spawn_macos_replace_script(
    script_path: &Path,
    source_app: &Path,
    target_app: &Path,
    staging_root: &Path,
    relaunch: bool,
    backup: bool,
) -> DesktopResult<()> {
    use std::os::unix::fs::PermissionsExt;

    ensure_parent_dir(script_path)?;
    ensure_parent_dir(target_app)?;
    let script = format!(
        r#"#!/bin/sh
set -eu
PID={pid}
SOURCE={source}
TARGET={target}
STAGING={staging}
RELAUNCH={relaunch}
BACKUP={backup}
while kill -0 "$PID" 2>/dev/null; do
  sleep 1
done
mkdir -p "$(dirname "$TARGET")"
if [ -d "$TARGET" ] && [ "$BACKUP" = "1" ]; then
  BACKUP_PATH="$TARGET.backup.$(date +%Y%m%d%H%M%S)"
  rm -rf "$BACKUP_PATH"
  mv "$TARGET" "$BACKUP_PATH"
else
  rm -rf "$TARGET"
fi
/usr/bin/ditto "$SOURCE" "$TARGET"
xattr -dr com.apple.quarantine "$TARGET" >/dev/null 2>&1 || true
if [ "$RELAUNCH" = "1" ]; then
  /usr/bin/open "$TARGET" >/dev/null 2>&1 || true
fi
rm -rf "$STAGING" >/dev/null 2>&1 || true
rm -f "$0" >/dev/null 2>&1 || true
"#,
        pid = std::process::id(),
        source = shell_quote_path(source_app),
        target = shell_quote_path(target_app),
        staging = shell_quote_path(staging_root),
        relaunch = if relaunch { "1" } else { "0" },
        backup = if backup { "1" } else { "0" },
    );
    fs::write(script_path, script).map_err(|error| {
        DesktopError::new(
            "UPDATE_INSTALL_SCRIPT_WRITE_FAILED",
            "Failed to write update install script",
        )
        .with_details(Value::String(error.to_string()))
    })?;
    fs::set_permissions(script_path, fs::Permissions::from_mode(0o700)).map_err(|error| {
        DesktopError::new(
            "UPDATE_INSTALL_SCRIPT_PERMISSION_FAILED",
            "Failed to mark update install script executable",
        )
        .with_details(Value::String(error.to_string()))
    })?;
    Command::new("/bin/sh")
        .arg(script_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            DesktopError::new(
                "UPDATE_INSTALL_SCRIPT_SPAWN_FAILED",
                "Failed to start update install script",
            )
            .with_details(Value::String(error.to_string()))
        })?;
    Ok(())
}

fn open_update_package(request: UpdateInstallRequest) -> DesktopResult<UpdateInstallReply> {
    let package_path = PathBuf::from(&request.path);
    if !package_path.exists() {
        return Err(
            DesktopError::new("UPDATE_PACKAGE_NOT_FOUND", "Update package was not found")
                .with_details(Value::String(request.path)),
        );
    }
    open_path(&package_path)?;
    Ok(UpdateInstallReply {
        status: "installing".to_string(),
        message: "Update package was opened with the system installer.".to_string(),
        path: Some(path_to_string(package_path)),
        target_path: request.target_path,
        relaunch_required: request.relaunch,
    })
}

fn open_path(path: &Path) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(path);
        return run_status(
            &mut command,
            "UPDATE_PACKAGE_OPEN_FAILED",
            "Failed to open update package",
        );
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]).arg(path);
        return run_status(
            &mut command,
            "UPDATE_PACKAGE_OPEN_FAILED",
            "Failed to open update package",
        );
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        run_status(
            &mut command,
            "UPDATE_PACKAGE_OPEN_FAILED",
            "Failed to open update package",
        )
    }
}

#[cfg(target_os = "macos")]
fn is_app_bundle(path: &Path) -> bool {
    has_extension(path, "app") && path.is_dir()
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

#[cfg(target_os = "macos")]
fn app_bundle_name(value: &str) -> String {
    ensure_extension(&sanitize_file_name(value), "app")
}

#[cfg(target_os = "macos")]
fn shell_quote_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn open_external(url: &str) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(url);
        return run_status(
            &mut command,
            "OPEN_EXTERNAL_FAILED",
            "Failed to open external URL",
        );
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", url]);
        return run_status(
            &mut command,
            "OPEN_EXTERNAL_FAILED",
            "Failed to open external URL",
        );
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        run_status(
            &mut command,
            "OPEN_EXTERNAL_FAILED",
            "Failed to open external URL",
        )
    }
}

fn copy_text(text: &str) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("pbcopy");
        return run_status_with_stdin(
            &mut command,
            text,
            "CLIPBOARD_WRITE_FAILED",
            "Failed to copy text",
        );
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("clip");
        return run_status_with_stdin(
            &mut command,
            text,
            "CLIPBOARD_WRITE_FAILED",
            "Failed to copy text",
        );
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        run_first_with_stdin(
            vec![
                CommandSpec::new("wl-copy", vec![]),
                CommandSpec::new("xclip", vec!["-selection", "clipboard"]),
                CommandSpec::new("xsel", vec!["--clipboard", "--input"]),
            ],
            text,
            "CLIPBOARD_WRITE_FAILED",
            "Failed to copy text",
        )
    }
}

fn notify(title: &str, body: Option<&str>) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display notification {} with title {}",
            applescript_string(body.unwrap_or("")),
            applescript_string(title)
        );
        return run_status(
            Command::new("osascript").args(["-e", &script]),
            "NOTIFICATION_FAILED",
            "Failed to show notification",
        );
    }
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "New-BurntToastNotification -Text {}, {}",
            powershell_string(title),
            powershell_string(body.unwrap_or(""))
        );
        return run_status(
            Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", &script]),
            "NOTIFICATION_FAILED",
            "Failed to show notification",
        );
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("notify-send");
        command.arg(title);
        if let Some(body) = body {
            command.arg(body);
        }
        run_status(
            &mut command,
            "NOTIFICATION_FAILED",
            "Failed to show notification",
        )
    }
}

fn open_file_dialog(request: OpenFileDialogRequest) -> DesktopResult<FileDialogReply> {
    #[cfg(target_os = "macos")]
    {
        let prompt = request.title.unwrap_or_else(|| "Choose a file".to_string());
        let mut script = if request.multiple {
            format!(
                "set selectedFiles to choose file with prompt {} with multiple selections allowed\nset output to \"\"\nrepeat with selectedFile in selectedFiles\nset output to output & POSIX path of selectedFile & linefeed\nend repeat\nreturn output",
                applescript_string(&prompt)
            )
        } else {
            format!(
                "POSIX path of (choose file with prompt {})",
                applescript_string(&prompt)
            )
        };
        if let Some(directory) = request.directory {
            script = format!(
                "set defaultDirectory to POSIX file {}\n{}",
                applescript_string(&directory),
                script.replace(
                    "choose file",
                    "choose file default location defaultDirectory"
                )
            );
        }
        let mut command = Command::new("osascript");
        command.args(["-e", &script]);
        return dialog_output(&mut command);
    }
    #[cfg(target_os = "windows")]
    {
        let title = request.title.unwrap_or_else(|| "Choose a file".to_string());
        let multiselect = if request.multiple { "$true" } else { "$false" };
        let initial_dir = request
            .directory
            .map(|value| format!("$dialog.InitialDirectory = {};", powershell_string(&value)))
            .unwrap_or_default();
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Title = {}; $dialog.Multiselect = {}; {} if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ $dialog.FileNames -join \"`n\" }}",
            powershell_string(&title),
            multiselect,
            initial_dir
        );
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-STA", "-Command", &script]);
        return dialog_output(&mut command);
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("zenity");
        command.arg("--file-selection");
        if request.multiple {
            command.args(["--multiple", "--separator=\n"]);
        }
        if let Some(title) = request.title {
            command.arg(format!("--title={title}"));
        }
        if let Some(directory) = request.directory {
            command.arg(format!("--filename={directory}/"));
        }
        dialog_output(&mut command)
    }
}

fn save_file_dialog(request: SaveFileDialogRequest) -> DesktopResult<SaveFileDialogReply> {
    #[cfg(target_os = "macos")]
    {
        let prompt = request.title.unwrap_or_else(|| "Save file".to_string());
        let default_name = request
            .default_file_name
            .unwrap_or_else(|| "export.json".to_string());
        let mut script = format!(
            "POSIX path of (choose file name with prompt {} default name {})",
            applescript_string(&prompt),
            applescript_string(&default_name)
        );
        if let Some(directory) = request.directory {
            script = format!(
                "set defaultDirectory to POSIX file {}\n{}",
                applescript_string(&directory),
                script.replace(
                    "choose file name",
                    "choose file name default location defaultDirectory"
                )
            );
        }
        let mut command = Command::new("osascript");
        command.args(["-e", &script]);
        let reply = dialog_output(&mut command)?;
        return Ok(SaveFileDialogReply {
            path: reply.paths.into_iter().next(),
            canceled: reply.canceled,
        });
    }
    #[cfg(target_os = "windows")]
    {
        let title = request.title.unwrap_or_else(|| "Save file".to_string());
        let file_name = request
            .default_file_name
            .unwrap_or_else(|| "export.json".to_string());
        let initial_dir = request
            .directory
            .map(|value| format!("$dialog.InitialDirectory = {};", powershell_string(&value)))
            .unwrap_or_default();
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.SaveFileDialog; $dialog.Title = {}; $dialog.FileName = {}; {} if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ $dialog.FileName }}",
            powershell_string(&title),
            powershell_string(&file_name),
            initial_dir
        );
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-STA", "-Command", &script]);
        let reply = dialog_output(&mut command)?;
        return Ok(SaveFileDialogReply {
            path: reply.paths.into_iter().next(),
            canceled: reply.canceled,
        });
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("zenity");
        command.args(["--file-selection", "--save", "--confirm-overwrite"]);
        if let Some(title) = request.title {
            command.arg(format!("--title={title}"));
        }
        if let Some(directory) = request.directory {
            let file_name = request.default_file_name.unwrap_or_default();
            command.arg(format!("--filename={directory}/{file_name}"));
        } else if let Some(file_name) = request.default_file_name {
            command.arg(format!("--filename={file_name}"));
        }
        let reply = dialog_output(&mut command)?;
        Ok(SaveFileDialogReply {
            path: reply.paths.into_iter().next(),
            canceled: reply.canceled,
        })
    }
}

fn platform_secure_get(service: &str, account: &str) -> DesktopResult<Option<String>> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("security")
            .args(["find-generic-password", "-a", account, "-s", service, "-w"])
            .output()
            .map_err(|error| {
                secure_command_error(
                    error,
                    "SECURE_KEYCHAIN_READ_FAILED",
                    "Failed to read macOS keychain value",
                )
            })?;
        if output.status.success() {
            return Ok(Some(
                String::from_utf8_lossy(&output.stdout)
                    .trim_end_matches('\n')
                    .to_string(),
            ));
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("could not be found")
            || stderr.contains("The specified item could not be found")
        {
            return Ok(None);
        }
        return Err(DesktopError::new(
            "SECURE_KEYCHAIN_READ_FAILED",
            "Failed to read macOS keychain value",
        )
        .with_details(Value::String(stderr.to_string())));
    }
    #[cfg(target_os = "windows")]
    {
        let path = windows_secure_path(service, account)?;
        if !path.exists() {
            return Ok(None);
        }
        let encrypted = fs::read_to_string(&path).map_err(|error| {
            DesktopError::new(
                "SECURE_DPAPI_FILE_READ_FAILED",
                "Failed to read Windows secure storage value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        let mut command = Command::new("powershell");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$encrypted = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString -String $encrypted; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }",
        ]);
        return command_output_with_stdin(
            &mut command,
            &encrypted,
            "SECURE_DPAPI_READ_FAILED",
            "Failed to unprotect Windows secure storage value",
        )
        .map(|value| Some(value.trim_end_matches('\n').to_string()));
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let output = Command::new("secret-tool")
            .args(["lookup", "service", service, "account", account])
            .output()
            .map_err(|error| {
                secure_command_error(
                    error,
                    "SECURE_SECRET_TOOL_READ_FAILED",
                    "Failed to read Linux Secret Service value",
                )
            })?;
        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout)
                .trim_end_matches('\n')
                .to_string();
            return Ok(Some(value));
        }
        Ok(None)
    }
}

fn platform_secure_set(service: &str, account: &str, value: &str) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("security");
        command.args([
            "add-generic-password",
            "-U",
            "-a",
            account,
            "-s",
            service,
            "-w",
            value,
        ]);
        return run_secure_status(
            &mut command,
            "SECURE_KEYCHAIN_WRITE_FAILED",
            "Failed to write macOS keychain value",
        );
    }
    #[cfg(target_os = "windows")]
    {
        let path = windows_secure_path(service, account)?;
        ensure_parent_dir(&path)?;
        let mut command = Command::new("powershell");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$plain = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString -String $plain -AsPlainText -Force; $secure | ConvertFrom-SecureString",
        ]);
        let encrypted = command_output_with_stdin(
            &mut command,
            value,
            "SECURE_DPAPI_WRITE_FAILED",
            "Failed to protect Windows secure storage value",
        )?;
        fs::write(&path, encrypted).map_err(|error| {
            DesktopError::new(
                "SECURE_DPAPI_FILE_WRITE_FAILED",
                "Failed to write Windows secure storage value",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        return Ok(());
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("secret-tool");
        command.args([
            "store",
            "--label",
            &format!("desktop-foundation {service} {account}"),
            "service",
            service,
            "account",
            account,
        ]);
        run_secure_status_with_stdin(
            &mut command,
            value,
            "SECURE_SECRET_TOOL_WRITE_FAILED",
            "Failed to write Linux Secret Service value",
        )
    }
}

fn platform_secure_remove(service: &str, account: &str) -> DesktopResult<()> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("security")
            .args(["delete-generic-password", "-a", account, "-s", service])
            .output()
            .map_err(|error| {
                secure_command_error(
                    error,
                    "SECURE_KEYCHAIN_REMOVE_FAILED",
                    "Failed to remove macOS keychain value",
                )
            })?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("could not be found")
            || stderr.contains("The specified item could not be found")
        {
            return Err(DesktopError::new(
                "SECURE_VALUE_NOT_FOUND",
                "Secure value was not found",
            ));
        }
        return Err(DesktopError::new(
            "SECURE_KEYCHAIN_REMOVE_FAILED",
            "Failed to remove macOS keychain value",
        )
        .with_details(Value::String(stderr.to_string())));
    }
    #[cfg(target_os = "windows")]
    {
        let path = windows_secure_path(service, account)?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| {
                DesktopError::new(
                    "SECURE_DPAPI_FILE_REMOVE_FAILED",
                    "Failed to remove Windows secure storage value",
                )
                .with_details(Value::String(error.to_string()))
            })?;
            return Ok(());
        }
        Err(DesktopError::new(
            "SECURE_VALUE_NOT_FOUND",
            "Secure value was not found",
        ))
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let mut command = Command::new("secret-tool");
        command.args(["clear", "service", service, "account", account]);
        let output = command.output().map_err(|error| {
            secure_command_error(
                error,
                "SECURE_SECRET_TOOL_REMOVE_FAILED",
                "Failed to remove Linux Secret Service value",
            )
        })?;
        if output.status.success() {
            Ok(())
        } else {
            Err(DesktopError::new(
                "SECURE_VALUE_NOT_FOUND",
                "Secure value was not found",
            ))
        }
    }
}

fn dialog_output(command: &mut Command) -> DesktopResult<FileDialogReply> {
    let output = command.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            DesktopError::new(
                "FILE_DIALOG_UNAVAILABLE",
                "File dialog command is not available",
            )
        } else {
            DesktopError::new("FILE_DIALOG_FAILED", "Failed to open file dialog")
                .with_details(Value::String(error.to_string()))
        }
    })?;
    if !output.status.success() {
        return Ok(FileDialogReply {
            paths: Vec::new(),
            canceled: true,
        });
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let paths = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    Ok(FileDialogReply {
        canceled: paths.is_empty(),
        paths,
    })
}

fn run_status(command: &mut Command, code: &str, message: &str) -> DesktopResult<()> {
    let output = command
        .output()
        .map_err(|error| command_error(error, code, message))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(DesktopError::new(code, message).with_details(Value::String(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )))
    }
}

fn run_secure_status(command: &mut Command, code: &str, message: &str) -> DesktopResult<()> {
    let output = command
        .output()
        .map_err(|error| secure_command_error(error, code, message))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(DesktopError::new(code, message).with_details(Value::String(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )))
    }
}

fn run_status_with_stdin(
    command: &mut Command,
    input: &str,
    code: &str,
    message: &str,
) -> DesktopResult<()> {
    command.stdin(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| command_error(error, code, message))?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| DesktopError::new(code, message))?
        .write_all(input.as_bytes())
        .map_err(|error| {
            DesktopError::new(code, message).with_details(Value::String(error.to_string()))
        })?;
    let output = child.wait_with_output().map_err(|error| {
        DesktopError::new(code, message).with_details(Value::String(error.to_string()))
    })?;
    if output.status.success() {
        Ok(())
    } else {
        Err(DesktopError::new(code, message).with_details(Value::String(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )))
    }
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn run_secure_status_with_stdin(
    command: &mut Command,
    input: &str,
    code: &str,
    message: &str,
) -> DesktopResult<()> {
    command.stdin(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| secure_command_error(error, code, message))?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| DesktopError::new(code, message))?
        .write_all(input.as_bytes())
        .map_err(|error| {
            DesktopError::new(code, message).with_details(Value::String(error.to_string()))
        })?;
    let output = child.wait_with_output().map_err(|error| {
        DesktopError::new(code, message).with_details(Value::String(error.to_string()))
    })?;
    if output.status.success() {
        Ok(())
    } else {
        Err(DesktopError::new(code, message).with_details(Value::String(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )))
    }
}

#[cfg(target_os = "windows")]
fn command_output_with_stdin(
    command: &mut Command,
    input: &str,
    code: &str,
    message: &str,
) -> DesktopResult<String> {
    command.stdin(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| secure_command_error(error, code, message))?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| DesktopError::new(code, message))?
        .write_all(input.as_bytes())
        .map_err(|error| {
            DesktopError::new(code, message).with_details(Value::String(error.to_string()))
        })?;
    let output = child.wait_with_output().map_err(|error| {
        DesktopError::new(code, message).with_details(Value::String(error.to_string()))
    })?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(DesktopError::new(code, message).with_details(Value::String(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )))
    }
}

#[cfg(target_os = "windows")]
fn windows_secure_path(service: &str, account: &str) -> DesktopResult<PathBuf> {
    dirs::data_dir()
        .map(|base| {
            base.join("desktop-foundation")
                .join("secure-dpapi")
                .join(sanitize_path_segment(service))
                .join(format!("{}.txt", sanitize_path_segment(account)))
        })
        .ok_or_else(|| {
            DesktopError::new(
                "SECURE_DPAPI_DIR_UNAVAILABLE",
                "Unable to resolve Windows secure storage directory",
            )
        })
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
struct CommandSpec {
    program: &'static str,
    args: Vec<&'static str>,
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
impl CommandSpec {
    fn new(program: &'static str, args: Vec<&'static str>) -> Self {
        Self { program, args }
    }
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn run_first_with_stdin(
    specs: Vec<CommandSpec>,
    input: &str,
    code: &str,
    message: &str,
) -> DesktopResult<()> {
    let mut last_error = None;
    for spec in specs {
        let mut command = Command::new(spec.program);
        command.args(spec.args);
        match run_status_with_stdin(&mut command, input, code, message) {
            Ok(()) => return Ok(()),
            Err(error) => last_error = Some(error),
        }
    }
    Err(last_error.unwrap_or_else(|| DesktopError::new(code, message)))
}

fn command_error(error: std::io::Error, code: &str, message: &str) -> DesktopError {
    if error.kind() == std::io::ErrorKind::NotFound {
        DesktopError::new(
            format!("{code}_UNAVAILABLE"),
            "Required platform command is not available",
        )
    } else {
        DesktopError::new(code, message).with_details(Value::String(error.to_string()))
    }
}

fn secure_command_error(error: std::io::Error, code: &str, message: &str) -> DesktopError {
    if error.kind() == std::io::ErrorKind::NotFound {
        DesktopError::new(
            "SECURE_PLATFORM_UNAVAILABLE",
            "Required platform secure storage command is not available",
        )
    } else {
        DesktopError::new(code, message).with_details(Value::String(error.to_string()))
    }
}

fn ensure_parent_dir(path: &Path) -> DesktopResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            DesktopError::new("FILE_CREATE_DIR_FAILED", "Failed to create file directory")
                .with_details(Value::String(error.to_string()))
        })?;
    }
    Ok(())
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().to_string()
}

fn sanitize_file_name(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            ch if ch.is_control() => '-',
            ch => ch,
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches([' ', '.', '-']);
    if trimmed.is_empty() {
        "export.json".to_string()
    } else {
        trimmed.to_string()
    }
}

fn sanitize_path_segment(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches(['.', '-']);
    if trimmed.is_empty() {
        "default".to_string()
    } else {
        trimmed.to_string()
    }
}

fn ensure_extension(file_name: &str, extension: &str) -> String {
    if file_name.rsplit('.').next() == Some(extension) {
        file_name.to_string()
    } else {
        format!("{file_name}.{extension}")
    }
}

fn applescript_string(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    )
}

#[cfg(target_os = "windows")]
fn powershell_string(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "desktop-foundation-system-test-{}-{name}",
            std::process::id()
        ))
    }

    #[test]
    fn file_secure_storage_fallback_round_trips_values() {
        let root = temp_path("secure");
        let _ = fs::remove_dir_all(&root);
        let adapter = FileSecureStorageAdapter::with_root(&root);

        adapter
            .set(SecureStorageSetRequest {
                namespace: "admin".to_string(),
                key: "token".to_string(),
                value: json!({ "token": "secret" }),
            })
            .unwrap();

        assert_eq!(
            adapter
                .get(SecureStorageGetRequest {
                    namespace: "admin".to_string(),
                    key: "token".to_string(),
                })
                .unwrap()
                .value,
            Some(json!({ "token": "secret" }))
        );

        adapter
            .remove(SecureStorageRemoveRequest {
                namespace: "admin".to_string(),
                key: "token".to_string(),
            })
            .unwrap();
        assert_eq!(
            adapter
                .get(SecureStorageGetRequest {
                    namespace: "admin".to_string(),
                    key: "token".to_string(),
                })
                .unwrap()
                .value,
            None
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn system_file_adapter_exports_sanitized_json() {
        let root = temp_path("exports");
        let _ = fs::remove_dir_all(&root);
        let adapter = SystemFileAdapter::new("test-product");
        let reply = adapter
            .export_json(ExportJsonRequest {
                file_name: "../report".to_string(),
                data: json!({ "ok": true }),
                directory: Some(root.to_string_lossy().to_string()),
            })
            .unwrap();

        let path = PathBuf::from(reply.path);
        assert!(path.starts_with(&root));
        assert_eq!(
            path.file_name().and_then(|value| value.to_str()),
            Some("report.json")
        );
        assert!(fs::read_to_string(path).unwrap().contains("\"ok\": true"));
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn app_bundle_name_appends_extension() {
        assert_eq!(app_bundle_name("Ops Admin"), "Ops Admin.app");
        assert_eq!(app_bundle_name("Ops/Admin.app"), "Ops-Admin.app");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn update_target_path_accepts_target_directory() {
        let request = UpdateInstallRequest {
            path: "/tmp/update.zip".to_string(),
            target_path: Some("/Applications".to_string()),
            app_name: Some("Ignored".to_string()),
            relaunch: true,
            backup: true,
        };
        let target = target_app_path(Path::new("/tmp/Ops Admin.app"), &request);
        assert_eq!(target, PathBuf::from("/Applications/Ops Admin.app"));
    }
}
