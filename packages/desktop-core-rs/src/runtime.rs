use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use base64::engine::general_purpose;
use base64::Engine as _;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::adapters::{
    DesktopAdapter, FileAdapter, HttpAdapter, NoopFileAdapter, NoopHttpAdapter, NoopSecureStorageAdapter,
    RecordingDesktopAdapter, SecureStorageAdapter,
};
use crate::desktop::{CopyTextRequest, DesktopActionReply, NotifyRequest, OpenExternalRequest};
use crate::error::{DesktopError, DesktopResult};
use crate::file::{
    DownloadFileReply, DownloadFileRequest, ExportJsonRequest, FileDialogReply, OpenFileDialogRequest,
    ReadTextFileRequest, SaveFileDialogReply, SaveFileDialogRequest, TextFileReply, WriteBinaryFileRequest,
    WriteTextFileRequest,
};
use crate::http::{HttpMethod, HttpRequest, HttpResponse, HttpResponseType};
use crate::persistence::{storage_entries_to_map, storage_map_to_entries, FilePersistence, PersistedState};
use crate::secure::{SecureStorageGetRequest, SecureStorageRemoveRequest, SecureStorageSetRequest};
use crate::security::SecurityPolicy;
use crate::session::{SessionClearRequest, SessionGetRequest, SessionSetRequest, SessionState};
use crate::storage::{StorageGetRequest, StorageRemoveRequest, StorageScope, StorageSetRequest, StorageValue};
use crate::system::{SystemDesktopAdapter, SystemFileAdapter, SystemSecureStorageAdapter};

#[derive(Debug, Clone, PartialEq)]
pub enum DesktopAction {
    OpenExternal(String),
    CopyText(String),
    Notify { title: String, body: Option<String> },
}

#[derive(Clone)]
pub struct DesktopCore {
    sessions: Arc<Mutex<BTreeMap<String, SessionState>>>,
    storage: Arc<Mutex<BTreeMap<StorageKey, Value>>>,
    actions: Arc<Mutex<Vec<DesktopAction>>>,
    http_adapter: Arc<dyn HttpAdapter>,
    desktop_adapter: Arc<dyn DesktopAdapter>,
    file_adapter: Arc<dyn FileAdapter>,
    secure_storage_adapter: Arc<dyn SecureStorageAdapter>,
    security_policy: Arc<SecurityPolicy>,
    persistence: Option<Arc<FilePersistence>>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct StorageKey {
    pub namespace: String,
    pub scope: StorageScope,
    pub key: String,
}

impl DesktopCore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_http_adapter(http_adapter: Arc<dyn HttpAdapter>) -> Self {
        let actions = Arc::new(Mutex::new(Vec::new()));
        Self {
            sessions: Arc::new(Mutex::new(BTreeMap::new())),
            storage: Arc::new(Mutex::new(BTreeMap::new())),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            actions,
            http_adapter,
            persistence: None,
        }
    }

    pub fn with_desktop_adapter(desktop_adapter: Arc<dyn DesktopAdapter>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(BTreeMap::new())),
            storage: Arc::new(Mutex::new(BTreeMap::new())),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter: Arc::new(NoopHttpAdapter),
            desktop_adapter,
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: None,
        }
    }

    pub fn with_adapters(http_adapter: Arc<dyn HttpAdapter>, desktop_adapter: Arc<dyn DesktopAdapter>) -> Self {
        Self::with_all_adapters(
            http_adapter,
            desktop_adapter,
            Arc::new(NoopFileAdapter),
            Arc::new(NoopSecureStorageAdapter),
        )
    }

    pub fn with_all_adapters(
        http_adapter: Arc<dyn HttpAdapter>,
        desktop_adapter: Arc<dyn DesktopAdapter>,
        file_adapter: Arc<dyn FileAdapter>,
        secure_storage_adapter: Arc<dyn SecureStorageAdapter>,
    ) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(BTreeMap::new())),
            storage: Arc::new(Mutex::new(BTreeMap::new())),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter,
            secure_storage_adapter,
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: None,
        }
    }

    pub fn with_security_policy(mut self, policy: SecurityPolicy) -> Self {
        self.security_policy = Arc::new(policy);
        self
    }

    pub fn persistent(app_id: &str) -> DesktopResult<Self> {
        Self::with_persistence_path(FilePersistence::default_path(app_id)?)
    }

    pub fn persistent_platform(app_id: &str) -> DesktopResult<Self> {
        Self::with_persistence_and_platform_adapters(FilePersistence::default_path(app_id)?, app_id, Arc::new(NoopHttpAdapter))
    }

    pub fn persistent_with_http_adapter(app_id: &str, http_adapter: Arc<dyn HttpAdapter>) -> DesktopResult<Self> {
        Self::with_persistence_and_http_adapter(FilePersistence::default_path(app_id)?, http_adapter)
    }

    pub fn persistent_platform_with_http_adapter(app_id: &str, http_adapter: Arc<dyn HttpAdapter>) -> DesktopResult<Self> {
        Self::with_persistence_and_platform_adapters(FilePersistence::default_path(app_id)?, app_id, http_adapter)
    }

    pub fn with_persistence_path(path: impl Into<std::path::PathBuf>) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        let actions = Arc::new(Mutex::new(Vec::new()));
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            actions,
            http_adapter: Arc::new(NoopHttpAdapter),
            persistence: Some(persistence),
        })
    }

    pub fn with_persistence_and_http_adapter(
        path: impl Into<std::path::PathBuf>,
        http_adapter: Arc<dyn HttpAdapter>,
    ) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        let actions = Arc::new(Mutex::new(Vec::new()));
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            actions,
            http_adapter,
            persistence: Some(persistence),
        })
    }

    pub fn with_persistence_and_adapters(
        path: impl Into<std::path::PathBuf>,
        http_adapter: Arc<dyn HttpAdapter>,
        desktop_adapter: Arc<dyn DesktopAdapter>,
    ) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: Some(persistence),
        })
    }

    pub fn with_persistence_and_all_adapters(
        path: impl Into<std::path::PathBuf>,
        http_adapter: Arc<dyn HttpAdapter>,
        desktop_adapter: Arc<dyn DesktopAdapter>,
        file_adapter: Arc<dyn FileAdapter>,
        secure_storage_adapter: Arc<dyn SecureStorageAdapter>,
    ) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter,
            secure_storage_adapter,
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: Some(persistence),
        })
    }

    pub fn with_persistence_and_platform_adapters(
        path: impl Into<std::path::PathBuf>,
        app_id: &str,
        http_adapter: Arc<dyn HttpAdapter>,
    ) -> DesktopResult<Self> {
        Self::with_persistence_and_all_adapters(
            path,
            http_adapter,
            Arc::new(SystemDesktopAdapter),
            Arc::new(SystemFileAdapter::new(app_id)),
            Arc::new(SystemSecureStorageAdapter::new(app_id)?),
        )
    }

    fn persist_state(&self) -> DesktopResult<()> {
        let Some(persistence) = &self.persistence else {
            return Ok(());
        };
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| DesktopError::new("SESSION_LOCK_FAILED", "Failed to lock session store"))?
            .clone();
        let storage = self
            .storage
            .lock()
            .map_err(|_| DesktopError::new("STORAGE_LOCK_FAILED", "Failed to lock storage"))?;
        persistence.save(&PersistedState {
            sessions,
            storage: storage_map_to_entries(&storage),
        })
    }

    pub fn http_request(&self, request: HttpRequest) -> DesktopResult<HttpResponse> {
        self.security_policy.validate_http_url(&request.url)?;
        let session = if request.auth == Some(false) {
            None
        } else {
            request
                .namespace
                .as_ref()
                .and_then(|namespace| self.session_get(SessionGetRequest { namespace: namespace.clone() }).ok())
        };
        self.http_adapter.request(request, session)
    }

    pub fn session_get(&self, request: SessionGetRequest) -> DesktopResult<SessionState> {
        Ok(self
            .sessions
            .lock()
            .map_err(|_| DesktopError::new("SESSION_LOCK_FAILED", "Failed to lock session store"))?
            .get(&request.namespace)
            .cloned()
            .unwrap_or_default())
    }

    pub fn session_set(&self, request: SessionSetRequest) -> DesktopResult<SessionState> {
        let state = SessionState {
            token: Some(request.token),
            remember: request.remember,
            user: request.user,
        };
        self.sessions
            .lock()
            .map_err(|_| DesktopError::new("SESSION_LOCK_FAILED", "Failed to lock session store"))?
            .insert(request.namespace, state.clone());
        self.persist_state()?;
        Ok(state)
    }

    pub fn session_clear(&self, request: SessionClearRequest) -> DesktopResult<DesktopActionReply> {
        self.sessions
            .lock()
            .map_err(|_| DesktopError::new("SESSION_LOCK_FAILED", "Failed to lock session store"))?
            .remove(&request.namespace);
        self.persist_state()?;
        Ok(DesktopActionReply { ok: true })
    }

    pub fn storage_get(&self, request: StorageGetRequest) -> DesktopResult<StorageValue> {
        if request.scope == StorageScope::Secure {
            return self.secure_storage_get(SecureStorageGetRequest {
                namespace: request.namespace,
                key: request.key,
            });
        }
        let key = StorageKey {
            namespace: request.namespace,
            scope: request.scope,
            key: request.key,
        };
        Ok(StorageValue {
            value: self
                .storage
                .lock()
                .map_err(|_| DesktopError::new("STORAGE_LOCK_FAILED", "Failed to lock storage"))?
                .get(&key)
                .cloned(),
        })
    }

    pub fn storage_set(&self, request: StorageSetRequest) -> DesktopResult<StorageValue> {
        if request.scope == StorageScope::Secure {
            return self.secure_storage_set(SecureStorageSetRequest {
                namespace: request.namespace,
                key: request.key,
                value: request.value,
            });
        }
        let key = StorageKey {
            namespace: request.namespace,
            scope: request.scope,
            key: request.key,
        };
        self.storage
            .lock()
            .map_err(|_| DesktopError::new("STORAGE_LOCK_FAILED", "Failed to lock storage"))?
            .insert(key, request.value.clone());
        self.persist_state()?;
        Ok(StorageValue {
            value: Some(request.value),
        })
    }

    pub fn storage_remove(&self, request: StorageRemoveRequest) -> DesktopResult<DesktopActionReply> {
        if request.scope == StorageScope::Secure {
            return self.secure_storage_remove(SecureStorageRemoveRequest {
                namespace: request.namespace,
                key: request.key,
            });
        }
        let key = StorageKey {
            namespace: request.namespace,
            scope: request.scope,
            key: request.key,
        };
        self.storage
            .lock()
            .map_err(|_| DesktopError::new("STORAGE_LOCK_FAILED", "Failed to lock storage"))?
            .remove(&key);
        self.persist_state()?;
        Ok(DesktopActionReply { ok: true })
    }

    pub fn open_external(&self, request: OpenExternalRequest) -> DesktopResult<DesktopActionReply> {
        self.security_policy.validate_external_url(&request.url)?;
        self.desktop_adapter.open_external(request)
    }

    pub fn copy_text(&self, request: CopyTextRequest) -> DesktopResult<DesktopActionReply> {
        self.desktop_adapter.copy_text(request)
    }

    pub fn notify(&self, request: NotifyRequest) -> DesktopResult<DesktopActionReply> {
        self.desktop_adapter.notify(request)
    }

    pub fn open_file_dialog(&self, request: OpenFileDialogRequest) -> DesktopResult<FileDialogReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy.validate_file_path(&PathBuf::from(directory))?;
        }
        self.file_adapter.open_file_dialog(request)
    }

    pub fn save_file_dialog(&self, request: SaveFileDialogRequest) -> DesktopResult<SaveFileDialogReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy.validate_file_path(&PathBuf::from(directory))?;
        }
        self.file_adapter.save_file_dialog(request)
    }

    pub fn read_text_file(&self, request: ReadTextFileRequest) -> DesktopResult<TextFileReply> {
        self.security_policy.validate_file_path(&PathBuf::from(&request.path))?;
        self.file_adapter.read_text_file(request)
    }

    pub fn write_text_file(&self, request: WriteTextFileRequest) -> DesktopResult<crate::file::FilePathReply> {
        self.security_policy.validate_file_path(&PathBuf::from(&request.path))?;
        self.file_adapter.write_text_file(request)
    }

    pub fn export_json(&self, request: ExportJsonRequest) -> DesktopResult<crate::file::FilePathReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy.validate_file_path(&PathBuf::from(directory))?;
        }
        self.file_adapter.export_json(request)
    }

    pub fn download_file(&self, request: DownloadFileRequest) -> DesktopResult<DownloadFileReply> {
        let path = download_target_path(&request)?;
        self.security_policy.validate_file_path(&path)?;
        let response = self.http_request(HttpRequest {
            method: HttpMethod::Get,
            url: request.url,
            headers: request.headers,
            query: request.query,
            body: None,
            body_base64: None,
            body_content_type: None,
            multipart: None,
            response_type: Some(HttpResponseType::Base64),
            timeout_ms: request.timeout_ms,
            auth: request.auth,
            request_id: request.request_id,
            namespace: request.namespace,
        })?;
        let body_base64 = response
            .body_base64
            .ok_or_else(|| DesktopError::new("DOWNLOAD_BODY_EMPTY", "Downloaded response did not include file bytes"))?;
        let bytes = general_purpose::STANDARD
            .decode(&body_base64)
            .map_err(|error| DesktopError::new("DOWNLOAD_BASE64_DECODE_FAILED", "Failed to decode downloaded file").with_details(Value::String(error.to_string())))?;
        self.file_adapter.write_binary_file(WriteBinaryFileRequest {
            path: path.to_string_lossy().to_string(),
            content_base64: body_base64,
            create_dir: true,
        })?;
        let sha256 = Sha256::digest(&bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        Ok(DownloadFileReply {
            path: path.to_string_lossy().to_string(),
            bytes: bytes.len() as u64,
            status: response.status,
            sha256: Some(sha256),
            request_id: response.request_id,
        })
    }

    pub fn secure_storage_get(&self, request: SecureStorageGetRequest) -> DesktopResult<StorageValue> {
        self.secure_storage_adapter.get(request)
    }

    pub fn secure_storage_set(&self, request: SecureStorageSetRequest) -> DesktopResult<StorageValue> {
        self.secure_storage_adapter.set(request)
    }

    pub fn secure_storage_remove(&self, request: SecureStorageRemoveRequest) -> DesktopResult<DesktopActionReply> {
        self.secure_storage_adapter.remove(request)
    }

    pub fn recorded_actions(&self) -> DesktopResult<Vec<DesktopAction>> {
        Ok(self
            .actions
            .lock()
            .map_err(|_| DesktopError::new("DESKTOP_ACTION_LOCK_FAILED", "Failed to lock desktop actions"))?
            .clone())
    }
}

fn download_target_path(request: &DownloadFileRequest) -> DesktopResult<PathBuf> {
    if let Some(path) = request.path.as_ref() {
        return Ok(PathBuf::from(path));
    }
    let directory = request
        .directory
        .as_ref()
        .map(PathBuf::from)
        .or_else(dirs::download_dir)
        .or_else(dirs::document_dir)
        .or_else(dirs::data_dir)
        .ok_or_else(|| DesktopError::new("DOWNLOAD_DIR_UNAVAILABLE", "Unable to resolve download directory"))?;
    let file_name = request
        .file_name
        .clone()
        .unwrap_or_else(|| infer_download_file_name(&request.url));
    Ok(directory.join(sanitize_download_file_name(&file_name)))
}

fn infer_download_file_name(url: &str) -> String {
    let path = url.split('?').next().unwrap_or(url).trim_end_matches('/');
    path.rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("download.bin")
        .to_string()
}

fn sanitize_download_file_name(value: &str) -> String {
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
        "download.bin".to_string()
    } else {
        trimmed.to_string()
    }
}

impl Default for DesktopCore {
    fn default() -> Self {
        let actions = Arc::new(Mutex::new(Vec::new()));
        Self {
            sessions: Arc::new(Mutex::new(BTreeMap::new())),
            storage: Arc::new(Mutex::new(BTreeMap::new())),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            actions,
            http_adapter: Arc::new(NoopHttpAdapter),
            persistence: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use serde_json::json;

    use crate::http::{HttpMethod, HttpRequest, HttpResponse};

    use super::*;

    struct EchoHttpAdapter {
        seen_token: Mutex<Option<String>>,
    }

    impl HttpAdapter for EchoHttpAdapter {
        fn request(&self, _request: HttpRequest, session: Option<SessionState>) -> DesktopResult<HttpResponse> {
            *self.seen_token.lock().unwrap() = session.and_then(|state| state.token);
            Ok(HttpResponse {
                status: 200,
                headers: BTreeMap::new(),
                body: Some(json!({ "ok": true })),
                body_base64: None,
                request_id: None,
            })
        }
    }

    #[test]
    fn session_is_isolated_by_namespace() {
        let core = DesktopCore::new();
        core.session_set(SessionSetRequest {
            namespace: "admin".to_string(),
            token: "admin-token".to_string(),
            remember: true,
            user: None,
        })
        .unwrap();
        core.session_set(SessionSetRequest {
            namespace: "merchant".to_string(),
            token: "merchant-token".to_string(),
            remember: false,
            user: None,
        })
        .unwrap();

        assert_eq!(
            core.session_get(SessionGetRequest {
                namespace: "admin".to_string()
            })
            .unwrap()
            .token,
            Some("admin-token".to_string())
        );
        assert_eq!(
            core.session_get(SessionGetRequest {
                namespace: "merchant".to_string()
            })
            .unwrap()
            .token,
            Some("merchant-token".to_string())
        );
    }

    #[test]
    fn storage_is_isolated_by_scope_and_namespace() {
        let core = DesktopCore::new();
        core.storage_set(StorageSetRequest {
            namespace: "admin".to_string(),
            scope: StorageScope::User,
            key: "table".to_string(),
            value: json!({ "density": "compact" }),
        })
        .unwrap();

        assert_eq!(
            core.storage_get(StorageGetRequest {
                namespace: "admin".to_string(),
                scope: StorageScope::User,
                key: "table".to_string()
            })
            .unwrap()
            .value,
            Some(json!({ "density": "compact" }))
        );
        assert_eq!(
            core.storage_get(StorageGetRequest {
                namespace: "merchant".to_string(),
                scope: StorageScope::User,
                key: "table".to_string()
            })
            .unwrap()
            .value,
            None
        );
    }

    #[test]
    fn http_adapter_receives_namespace_session() {
        let adapter = Arc::new(EchoHttpAdapter {
            seen_token: Mutex::new(None),
        });
        let core = DesktopCore::with_http_adapter(adapter.clone());
        core.session_set(SessionSetRequest {
            namespace: "admin".to_string(),
            token: "admin-token".to_string(),
            remember: false,
            user: None,
        })
        .unwrap();

        let reply = core
            .http_request(HttpRequest {
                method: HttpMethod::Get,
                url: "https://example.test".to_string(),
                headers: BTreeMap::new(),
                query: BTreeMap::new(),
                body: None,
                body_base64: None,
                body_content_type: None,
                multipart: None,
                response_type: None,
                timeout_ms: None,
                auth: None,
                request_id: None,
                namespace: Some("admin".to_string()),
            })
            .unwrap();

        assert_eq!(reply.status, 200);
        assert_eq!(*adapter.seen_token.lock().unwrap(), Some("admin-token".to_string()));
    }

    #[test]
    fn persistent_core_restores_session_and_storage() {
        let path = std::env::temp_dir().join(format!(
            "desktop-foundation-test-{}-{}.json",
            std::process::id(),
            "persistent-core"
        ));
        let _ = std::fs::remove_file(&path);

        let core = DesktopCore::with_persistence_path(&path).unwrap();
        core.session_set(SessionSetRequest {
            namespace: "admin".to_string(),
            token: "persisted-token".to_string(),
            remember: true,
            user: None,
        })
        .unwrap();
        core.storage_set(StorageSetRequest {
            namespace: "admin".to_string(),
            scope: StorageScope::App,
            key: "window".to_string(),
            value: json!({ "width": 1200 }),
        })
        .unwrap();

        let restored = DesktopCore::with_persistence_path(&path).unwrap();
        assert_eq!(
            restored
                .session_get(SessionGetRequest {
                    namespace: "admin".to_string()
                })
                .unwrap()
                .token,
            Some("persisted-token".to_string())
        );
        assert_eq!(
            restored
                .storage_get(StorageGetRequest {
                    namespace: "admin".to_string(),
                    scope: StorageScope::App,
                    key: "window".to_string(),
                })
                .unwrap()
                .value,
            Some(json!({ "width": 1200 }))
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn secure_scope_is_not_written_to_plain_persistence() {
        let path = std::env::temp_dir().join(format!(
            "desktop-foundation-test-{}-{}.json",
            std::process::id(),
            "secure-scope"
        ));
        let _ = std::fs::remove_file(&path);

        let core = DesktopCore::with_persistence_path(&path).unwrap();
        core.storage_set(StorageSetRequest {
            namespace: "admin".to_string(),
            scope: StorageScope::Secure,
            key: "token".to_string(),
            value: json!("secret-token"),
        })
        .unwrap();

        let text = std::fs::read_to_string(&path).unwrap_or_default();
        assert!(!text.contains("secret-token"));
        assert!(!text.contains("\"secure\""));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn security_policy_blocks_unlisted_http_hosts_before_adapter() {
        let adapter = Arc::new(EchoHttpAdapter {
            seen_token: Mutex::new(None),
        });
        let core = DesktopCore::with_http_adapter(adapter.clone()).with_security_policy(SecurityPolicy {
            allowed_http_hosts: vec!["api.example.com".to_string()],
            ..SecurityPolicy::default()
        });

        let error = core
            .http_request(HttpRequest {
                method: HttpMethod::Get,
                url: "https://blocked.example.com".to_string(),
                headers: BTreeMap::new(),
                query: BTreeMap::new(),
                body: None,
                body_base64: None,
                body_content_type: None,
                multipart: None,
                response_type: None,
                timeout_ms: None,
                auth: None,
                request_id: None,
                namespace: Some("admin".to_string()),
            })
            .unwrap_err();

        assert_eq!(error.code, "HTTP_HOST_BLOCKED");
        assert_eq!(*adapter.seen_token.lock().unwrap(), None);
    }

    #[test]
    fn security_policy_blocks_external_hosts_before_recording_action() {
        let core = DesktopCore::new().with_security_policy(SecurityPolicy {
            allowed_external_hosts: vec!["docs.example.com".to_string()],
            allowed_external_schemes: vec!["https".to_string()],
            ..SecurityPolicy::default()
        });

        let error = core
            .open_external(OpenExternalRequest {
                url: "https://blocked.example.com".to_string(),
            })
            .unwrap_err();

        assert_eq!(error.code, "EXTERNAL_HOST_BLOCKED");
        assert!(core.recorded_actions().unwrap().is_empty());
    }
}
