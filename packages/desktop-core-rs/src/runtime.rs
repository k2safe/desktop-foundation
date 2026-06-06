use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose;
use base64::Engine as _;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::adapters::{
    DesktopAdapter, FileAdapter, HttpAdapter, NoopFileAdapter, NoopHttpAdapter,
    NoopSecureStorageAdapter, NoopUpdateInstallerAdapter, RecordingDesktopAdapter,
    SecureStorageAdapter, UpdateInstallerAdapter,
};
use crate::desktop::{CopyTextRequest, DesktopActionReply, NotifyRequest, OpenExternalRequest};
use crate::error::{DesktopError, DesktopResult};
use crate::file::{
    DownloadFileReply, DownloadFileRequest, ExportJsonRequest, FileDialogReply,
    OpenFileDialogRequest, ReadTextFileRequest, SaveFileDialogReply, SaveFileDialogRequest,
    TextFileReply, WriteBinaryFileRequest, WriteTextFileRequest,
};
use crate::http::{
    HttpCacheEntry, HttpCacheMetadata, HttpCacheOptions, HttpCacheStorage, HttpMethod, HttpRequest,
    HttpResponse, HttpResponseType,
};
use crate::persistence::{
    storage_entries_to_map, storage_map_to_entries, FilePersistence, PersistedState,
};
use crate::proxy::{ProxyConfig, ProxyTestRequest, ProxyTestResult};
use crate::secure::{SecureStorageGetRequest, SecureStorageRemoveRequest, SecureStorageSetRequest};
use crate::security::SecurityPolicy;
use crate::session::{SessionClearRequest, SessionGetRequest, SessionSetRequest, SessionState};
use crate::storage::{
    StorageGetRequest, StorageRemoveRequest, StorageScope, StorageSetRequest, StorageValue,
};
use crate::system::{
    SystemDesktopAdapter, SystemFileAdapter, SystemSecureStorageAdapter,
    SystemUpdateInstallerAdapter,
};
use crate::update::{UpdateInstallReply, UpdateInstallRequest};

const PROXY_NAMESPACE: &str = "desktop-foundation.proxy";
const PROXY_PASSWORD_KEY: &str = "password";
const DEFAULT_PROXY_TEST_URL: &str = "https://www.gstatic.com/generate_204";

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
    http_cache: Arc<Mutex<BTreeMap<String, HttpCacheEntry>>>,
    proxy_config: Arc<Mutex<ProxyConfig>>,
    actions: Arc<Mutex<Vec<DesktopAction>>>,
    http_adapter: Arc<dyn HttpAdapter>,
    desktop_adapter: Arc<dyn DesktopAdapter>,
    file_adapter: Arc<dyn FileAdapter>,
    secure_storage_adapter: Arc<dyn SecureStorageAdapter>,
    update_installer_adapter: Arc<dyn UpdateInstallerAdapter>,
    security_policy: Arc<SecurityPolicy>,
    persistence: Option<Arc<FilePersistence>>,
}

fn empty_http_cache() -> Arc<Mutex<BTreeMap<String, HttpCacheEntry>>> {
    Arc::new(Mutex::new(BTreeMap::new()))
}

fn default_proxy_config() -> Arc<Mutex<ProxyConfig>> {
    Arc::new(Mutex::new(ProxyConfig::default()))
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct StorageKey {
    pub namespace: String,
    pub scope: StorageScope,
    pub key: String,
}

#[derive(Debug, Clone)]
struct HttpCacheContext {
    key: String,
    ttl_ms: u64,
    storage: HttpCacheStorage,
    refresh: bool,
    stale_if_error: bool,
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
            http_cache: empty_http_cache(),
            proxy_config: default_proxy_config(),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
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
            http_cache: empty_http_cache(),
            proxy_config: default_proxy_config(),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter: Arc::new(NoopHttpAdapter),
            desktop_adapter,
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: None,
        }
    }

    pub fn with_adapters(
        http_adapter: Arc<dyn HttpAdapter>,
        desktop_adapter: Arc<dyn DesktopAdapter>,
    ) -> Self {
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
            http_cache: empty_http_cache(),
            proxy_config: default_proxy_config(),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter,
            secure_storage_adapter,
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: None,
        }
    }

    pub fn with_security_policy(mut self, policy: SecurityPolicy) -> Self {
        self.security_policy = Arc::new(policy);
        self
    }

    pub fn with_update_installer_adapter(
        mut self,
        update_installer_adapter: Arc<dyn UpdateInstallerAdapter>,
    ) -> Self {
        self.update_installer_adapter = update_installer_adapter;
        self
    }

    pub fn persistent(app_id: &str) -> DesktopResult<Self> {
        Self::with_persistence_path(FilePersistence::default_path(app_id)?)
    }

    pub fn persistent_platform(app_id: &str) -> DesktopResult<Self> {
        Self::with_persistence_and_platform_adapters(
            FilePersistence::default_path(app_id)?,
            app_id,
            Arc::new(NoopHttpAdapter),
        )
    }

    pub fn persistent_with_http_adapter(
        app_id: &str,
        http_adapter: Arc<dyn HttpAdapter>,
    ) -> DesktopResult<Self> {
        Self::with_persistence_and_http_adapter(
            FilePersistence::default_path(app_id)?,
            http_adapter,
        )
    }

    pub fn persistent_platform_with_http_adapter(
        app_id: &str,
        http_adapter: Arc<dyn HttpAdapter>,
    ) -> DesktopResult<Self> {
        Self::with_persistence_and_platform_adapters(
            FilePersistence::default_path(app_id)?,
            app_id,
            http_adapter,
        )
    }

    pub fn with_persistence_path(path: impl Into<std::path::PathBuf>) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        let actions = Arc::new(Mutex::new(Vec::new()));
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            http_cache: Arc::new(Mutex::new(state.http_cache)),
            proxy_config: Arc::new(Mutex::new(state.proxy_config.for_persistence())),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
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
            http_cache: Arc::new(Mutex::new(state.http_cache)),
            proxy_config: Arc::new(Mutex::new(state.proxy_config.for_persistence())),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
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
            http_cache: Arc::new(Mutex::new(state.http_cache)),
            proxy_config: Arc::new(Mutex::new(state.proxy_config.for_persistence())),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
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
            http_cache: Arc::new(Mutex::new(state.http_cache)),
            proxy_config: Arc::new(Mutex::new(state.proxy_config.for_persistence())),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter,
            file_adapter,
            secure_storage_adapter,
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: Some(persistence),
        })
    }

    pub fn with_persistence_and_platform_adapters(
        path: impl Into<std::path::PathBuf>,
        app_id: &str,
        http_adapter: Arc<dyn HttpAdapter>,
    ) -> DesktopResult<Self> {
        let persistence = Arc::new(FilePersistence::new(path));
        let state = persistence.load()?;
        Ok(Self {
            sessions: Arc::new(Mutex::new(state.sessions)),
            storage: Arc::new(Mutex::new(storage_entries_to_map(state.storage))),
            http_cache: Arc::new(Mutex::new(state.http_cache)),
            proxy_config: Arc::new(Mutex::new(state.proxy_config.for_persistence())),
            actions: Arc::new(Mutex::new(Vec::new())),
            http_adapter,
            desktop_adapter: Arc::new(SystemDesktopAdapter),
            file_adapter: Arc::new(SystemFileAdapter::new(app_id)),
            secure_storage_adapter: Arc::new(SystemSecureStorageAdapter::new(app_id)?),
            update_installer_adapter: Arc::new(SystemUpdateInstallerAdapter::new(app_id)),
            security_policy: Arc::new(SecurityPolicy::default()),
            persistence: Some(persistence),
        })
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
        let http_cache = self.http_cache.lock().map_err(|_| {
            DesktopError::new("HTTP_CACHE_LOCK_FAILED", "Failed to lock HTTP cache")
        })?;
        let proxy_config = self
            .proxy_config
            .lock()
            .map_err(|_| DesktopError::new("PROXY_LOCK_FAILED", "Failed to lock proxy config"))?
            .clone()
            .for_persistence();
        persistence.save(&PersistedState {
            sessions,
            storage: storage_map_to_entries(&storage),
            http_cache: http_cache
                .iter()
                .filter(|(_key, entry)| entry.storage == HttpCacheStorage::Persistent)
                .map(|(key, entry)| (key.clone(), entry.clone()))
                .collect(),
            proxy_config,
        })
    }

    pub fn http_request(&self, request: HttpRequest) -> DesktopResult<HttpResponse> {
        self.security_policy.validate_http_url(&request.url)?;
        let cache_context = self.resolve_http_cache(&request)?;
        if let Some(context) = cache_context.as_ref().filter(|context| !context.refresh) {
            if let Some(response) =
                self.read_cached_http_response(context, request.request_id.clone(), false)?
            {
                return Ok(response);
            }
        }
        let session = if request.auth == Some(false) {
            None
        } else {
            request.namespace.as_ref().and_then(|namespace| {
                self.session_get(SessionGetRequest {
                    namespace: namespace.clone(),
                })
                .ok()
            })
        };
        let proxy = self.effective_proxy_config()?;
        match self
            .http_adapter
            .request(request.clone(), session, Some(proxy))
        {
            Ok(mut response) => {
                if let Some(context) = cache_context {
                    self.write_http_cache(&context, &response)?;
                    if let Some(entry) = self
                        .http_cache
                        .lock()
                        .map_err(|_| {
                            DesktopError::new("HTTP_CACHE_LOCK_FAILED", "Failed to lock HTTP cache")
                        })?
                        .get(&context.key)
                        .cloned()
                    {
                        response.cache =
                            Some(http_cache_metadata(&context.key, &entry, false, false));
                    }
                }
                Ok(response)
            }
            Err(error) => {
                if let Some(context) = cache_context
                    .as_ref()
                    .filter(|context| context.stale_if_error)
                {
                    if let Some(response) =
                        self.read_cached_http_response(context, request.request_id.clone(), true)?
                    {
                        return Ok(response);
                    }
                }
                Err(error)
            }
        }
    }

    pub fn proxy_get_config(&self) -> DesktopResult<ProxyConfig> {
        let config = self
            .proxy_config
            .lock()
            .map_err(|_| DesktopError::new("PROXY_LOCK_FAILED", "Failed to lock proxy config"))?
            .clone();
        Ok(config.without_password(self.proxy_password()?.is_some()))
    }

    pub fn proxy_set_config(&self, mut config: ProxyConfig) -> DesktopResult<ProxyConfig> {
        config.proxy_url()?;
        let stores_credentials = config.uses_explicit_proxy();
        let password = if stores_credentials {
            config.password.take().filter(|value| !value.is_empty())
        } else {
            config.password = None;
            None
        };
        let keep_existing_password =
            stores_credentials && config.has_password && password.is_none();
        let has_password = if let Some(password) = password {
            self.secure_storage_adapter.set(SecureStorageSetRequest {
                namespace: PROXY_NAMESPACE.to_string(),
                key: PROXY_PASSWORD_KEY.to_string(),
                value: Value::String(password),
            })?;
            true
        } else if keep_existing_password {
            self.proxy_password()?.is_some()
        } else {
            self.secure_storage_adapter
                .remove(SecureStorageRemoveRequest {
                    namespace: PROXY_NAMESPACE.to_string(),
                    key: PROXY_PASSWORD_KEY.to_string(),
                })?;
            false
        };

        let stored = config.without_password(false).for_persistence();
        {
            *self.proxy_config.lock().map_err(|_| {
                DesktopError::new("PROXY_LOCK_FAILED", "Failed to lock proxy config")
            })? = stored.clone();
        }
        self.persist_state()?;
        Ok(stored.without_password(has_password))
    }

    pub fn proxy_clear_config(&self) -> DesktopResult<DesktopActionReply> {
        {
            *self.proxy_config.lock().map_err(|_| {
                DesktopError::new("PROXY_LOCK_FAILED", "Failed to lock proxy config")
            })? = ProxyConfig::default();
        }
        self.secure_storage_adapter
            .remove(SecureStorageRemoveRequest {
                namespace: PROXY_NAMESPACE.to_string(),
                key: PROXY_PASSWORD_KEY.to_string(),
            })?;
        self.persist_state()?;
        Ok(DesktopActionReply { ok: true })
    }

    pub fn proxy_test(&self, request: ProxyTestRequest) -> ProxyTestResult {
        let url = request
            .url
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_PROXY_TEST_URL.to_string());
        let started = Instant::now();
        let result = self.http_request(HttpRequest {
            method: HttpMethod::Get,
            url,
            headers: BTreeMap::new(),
            query: BTreeMap::new(),
            body: None,
            body_base64: None,
            body_content_type: None,
            multipart: None,
            response_type: Some(HttpResponseType::Text),
            timeout_ms: Some(request.timeout_ms.unwrap_or(10_000)),
            auth: Some(false),
            request_id: Some("proxy-test".to_string()),
            namespace: Some(PROXY_NAMESPACE.to_string()),
            cache: None,
        });
        let latency_ms = started.elapsed().as_millis().try_into().unwrap_or(u64::MAX);
        match result {
            Ok(_) => ProxyTestResult {
                ok: true,
                latency_ms: Some(latency_ms),
                message: None,
            },
            Err(error) => ProxyTestResult {
                ok: false,
                latency_ms: Some(latency_ms),
                message: Some(error.message),
            },
        }
    }

    fn effective_proxy_config(&self) -> DesktopResult<ProxyConfig> {
        let mut config = self
            .proxy_config
            .lock()
            .map_err(|_| DesktopError::new("PROXY_LOCK_FAILED", "Failed to lock proxy config"))?
            .clone();
        if config.password.is_none() {
            config.password = self.proxy_password()?;
        }
        Ok(config)
    }

    fn proxy_password(&self) -> DesktopResult<Option<String>> {
        let value = self.secure_storage_adapter.get(SecureStorageGetRequest {
            namespace: PROXY_NAMESPACE.to_string(),
            key: PROXY_PASSWORD_KEY.to_string(),
        })?;
        Ok(value.value.and_then(|value| match value {
            Value::String(value) if !value.is_empty() => Some(value),
            _ => None,
        }))
    }

    fn resolve_http_cache(&self, request: &HttpRequest) -> DesktopResult<Option<HttpCacheContext>> {
        let Some(cache) = request.cache.as_ref().filter(|cache| cache.ttl_ms > 0) else {
            return Ok(None);
        };
        let requested_storage = cache
            .storage
            .clone()
            .unwrap_or(HttpCacheStorage::Persistent);
        let storage =
            if requested_storage == HttpCacheStorage::Persistent && self.persistence.is_none() {
                HttpCacheStorage::Memory
            } else {
                requested_storage
            };
        Ok(Some(HttpCacheContext {
            key: http_cache_key(request, cache)?,
            ttl_ms: cache.ttl_ms,
            storage,
            refresh: cache.refresh.unwrap_or(false),
            stale_if_error: cache.stale_if_error.unwrap_or(false),
        }))
    }

    fn read_cached_http_response(
        &self,
        context: &HttpCacheContext,
        request_id: Option<String>,
        allow_stale: bool,
    ) -> DesktopResult<Option<HttpResponse>> {
        let now = current_time_ms();
        let entry = self
            .http_cache
            .lock()
            .map_err(|_| DesktopError::new("HTTP_CACHE_LOCK_FAILED", "Failed to lock HTTP cache"))?
            .get(&context.key)
            .cloned();
        let Some(entry) = entry else {
            return Ok(None);
        };
        let stale = now > entry.expires_at;
        if stale && !allow_stale {
            return Ok(None);
        }
        Ok(Some(http_response_from_cache_entry(
            &context.key,
            &entry,
            request_id,
            stale,
        )))
    }

    fn write_http_cache(
        &self,
        context: &HttpCacheContext,
        response: &HttpResponse,
    ) -> DesktopResult<()> {
        let stored_at = current_time_ms();
        let expires_at = stored_at.saturating_add(context.ttl_ms);
        let entry = HttpCacheEntry {
            status: response.status,
            headers: response.headers.clone(),
            body: response.body.clone(),
            body_base64: response.body_base64.clone(),
            request_id: response.request_id.clone(),
            storage: context.storage.clone(),
            stored_at,
            expires_at,
        };
        {
            self.http_cache
                .lock()
                .map_err(|_| {
                    DesktopError::new("HTTP_CACHE_LOCK_FAILED", "Failed to lock HTTP cache")
                })?
                .insert(context.key.clone(), entry);
        }
        if context.storage == HttpCacheStorage::Persistent {
            self.persist_state()?;
        }
        Ok(())
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

    pub fn storage_remove(
        &self,
        request: StorageRemoveRequest,
    ) -> DesktopResult<DesktopActionReply> {
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

    pub fn open_file_dialog(
        &self,
        request: OpenFileDialogRequest,
    ) -> DesktopResult<FileDialogReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy
                .validate_file_path(&PathBuf::from(directory))?;
        }
        self.file_adapter.open_file_dialog(request)
    }

    pub fn save_file_dialog(
        &self,
        request: SaveFileDialogRequest,
    ) -> DesktopResult<SaveFileDialogReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy
                .validate_file_path(&PathBuf::from(directory))?;
        }
        self.file_adapter.save_file_dialog(request)
    }

    pub fn read_text_file(&self, request: ReadTextFileRequest) -> DesktopResult<TextFileReply> {
        self.security_policy
            .validate_file_path(&PathBuf::from(&request.path))?;
        self.file_adapter.read_text_file(request)
    }

    pub fn write_text_file(
        &self,
        request: WriteTextFileRequest,
    ) -> DesktopResult<crate::file::FilePathReply> {
        self.security_policy
            .validate_file_path(&PathBuf::from(&request.path))?;
        self.file_adapter.write_text_file(request)
    }

    pub fn export_json(
        &self,
        request: ExportJsonRequest,
    ) -> DesktopResult<crate::file::FilePathReply> {
        if let Some(directory) = request.directory.as_ref() {
            self.security_policy
                .validate_file_path(&PathBuf::from(directory))?;
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
            cache: None,
        })?;
        let body_base64 = response.body_base64.ok_or_else(|| {
            DesktopError::new(
                "DOWNLOAD_BODY_EMPTY",
                "Downloaded response did not include file bytes",
            )
        })?;
        let bytes = general_purpose::STANDARD
            .decode(&body_base64)
            .map_err(|error| {
                DesktopError::new(
                    "DOWNLOAD_BASE64_DECODE_FAILED",
                    "Failed to decode downloaded file",
                )
                .with_details(Value::String(error.to_string()))
            })?;
        self.file_adapter
            .write_binary_file(WriteBinaryFileRequest {
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

    pub fn install_update(
        &self,
        request: UpdateInstallRequest,
    ) -> DesktopResult<UpdateInstallReply> {
        self.security_policy
            .validate_file_path(&PathBuf::from(&request.path))?;
        if let Some(target_path) = request.target_path.as_ref() {
            self.security_policy
                .validate_file_path(&PathBuf::from(target_path))?;
        }
        self.update_installer_adapter.install_update(request)
    }

    pub fn secure_storage_get(
        &self,
        request: SecureStorageGetRequest,
    ) -> DesktopResult<StorageValue> {
        self.secure_storage_adapter.get(request)
    }

    pub fn secure_storage_set(
        &self,
        request: SecureStorageSetRequest,
    ) -> DesktopResult<StorageValue> {
        self.secure_storage_adapter.set(request)
    }

    pub fn secure_storage_remove(
        &self,
        request: SecureStorageRemoveRequest,
    ) -> DesktopResult<DesktopActionReply> {
        self.secure_storage_adapter.remove(request)
    }

    pub fn recorded_actions(&self) -> DesktopResult<Vec<DesktopAction>> {
        Ok(self
            .actions
            .lock()
            .map_err(|_| {
                DesktopError::new(
                    "DESKTOP_ACTION_LOCK_FAILED",
                    "Failed to lock desktop actions",
                )
            })?
            .clone())
    }
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or_default()
}

fn http_cache_key(request: &HttpRequest, cache: &HttpCacheOptions) -> DesktopResult<String> {
    if let Some(key) = cache
        .key
        .as_deref()
        .map(str::trim)
        .filter(|key| !key.is_empty())
    {
        return Ok(key.to_string());
    }
    let canonical = serde_json::json!({
        "method": &request.method,
        "url": &request.url,
        "headers": request.headers.iter().filter(|(key, _value)| !key.eq_ignore_ascii_case("authorization")).collect::<BTreeMap<_, _>>(),
        "query": &request.query,
        "body": &request.body,
        "bodyBase64Sha256": request.body_base64.as_ref().map(|value| sha256_hex(value.as_bytes())),
        "bodyContentType": &request.body_content_type,
        "multipart": &request.multipart,
        "responseType": &request.response_type,
        "auth": &request.auth,
        "namespace": &request.namespace,
    });
    let text = serde_json::to_string(&canonical).map_err(|error| {
        DesktopError::new(
            "HTTP_CACHE_KEY_SERIALIZE_FAILED",
            "Failed to serialize HTTP cache key",
        )
        .with_details(Value::String(error.to_string()))
    })?;
    Ok(format!("http:{}", sha256_hex(text.as_bytes())))
}

fn http_response_from_cache_entry(
    key: &str,
    entry: &HttpCacheEntry,
    request_id: Option<String>,
    stale: bool,
) -> HttpResponse {
    HttpResponse {
        status: entry.status,
        headers: entry.headers.clone(),
        body: entry.body.clone(),
        body_base64: entry.body_base64.clone(),
        request_id: request_id.or_else(|| entry.request_id.clone()),
        cache: Some(http_cache_metadata(key, entry, true, stale)),
    }
}

fn http_cache_metadata(
    key: &str,
    entry: &HttpCacheEntry,
    hit: bool,
    stale: bool,
) -> HttpCacheMetadata {
    HttpCacheMetadata {
        hit,
        stale,
        key: key.to_string(),
        storage: entry.storage.clone(),
        stored_at: entry.stored_at,
        expires_at: entry.expires_at,
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
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
        .ok_or_else(|| {
            DesktopError::new(
                "DOWNLOAD_DIR_UNAVAILABLE",
                "Unable to resolve download directory",
            )
        })?;
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
            http_cache: empty_http_cache(),
            proxy_config: default_proxy_config(),
            desktop_adapter: Arc::new(RecordingDesktopAdapter::new(actions.clone())),
            file_adapter: Arc::new(NoopFileAdapter),
            secure_storage_adapter: Arc::new(NoopSecureStorageAdapter),
            update_installer_adapter: Arc::new(NoopUpdateInstallerAdapter),
            security_policy: Arc::new(SecurityPolicy::default()),
            actions,
            http_adapter: Arc::new(NoopHttpAdapter),
            persistence: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::Mutex;
    use std::time::Duration;

    use serde_json::json;

    use crate::http::{HttpCacheOptions, HttpCacheStorage, HttpMethod, HttpRequest, HttpResponse};
    use crate::proxy::ProxyMode;
    use crate::system::FileSecureStorageAdapter;

    use super::*;

    struct EchoHttpAdapter {
        seen_token: Mutex<Option<String>>,
    }

    struct CountingHttpAdapter {
        calls: Mutex<u32>,
        fail_after_first: bool,
    }

    struct RecordingUpdateInstaller {
        seen: Mutex<Vec<UpdateInstallRequest>>,
    }

    struct ProxyRecordingHttpAdapter {
        seen_proxy: Mutex<Option<ProxyConfig>>,
    }

    impl HttpAdapter for EchoHttpAdapter {
        fn request(
            &self,
            _request: HttpRequest,
            session: Option<SessionState>,
            _proxy: Option<ProxyConfig>,
        ) -> DesktopResult<HttpResponse> {
            *self.seen_token.lock().unwrap() = session.and_then(|state| state.token);
            Ok(HttpResponse {
                status: 200,
                headers: BTreeMap::new(),
                body: Some(json!({ "ok": true })),
                body_base64: None,
                request_id: None,
                cache: None,
            })
        }
    }

    impl HttpAdapter for CountingHttpAdapter {
        fn request(
            &self,
            _request: HttpRequest,
            _session: Option<SessionState>,
            _proxy: Option<ProxyConfig>,
        ) -> DesktopResult<HttpResponse> {
            let mut calls = self.calls.lock().unwrap();
            *calls += 1;
            if self.fail_after_first && *calls > 1 {
                return Err(DesktopError::new(
                    "TEST_HTTP_DOWN",
                    "test adapter unavailable",
                ));
            }
            Ok(HttpResponse {
                status: 200,
                headers: BTreeMap::new(),
                body: Some(json!({ "count": *calls })),
                body_base64: None,
                request_id: None,
                cache: None,
            })
        }
    }

    impl HttpAdapter for ProxyRecordingHttpAdapter {
        fn request(
            &self,
            _request: HttpRequest,
            _session: Option<SessionState>,
            proxy: Option<ProxyConfig>,
        ) -> DesktopResult<HttpResponse> {
            *self.seen_proxy.lock().unwrap() = proxy;
            Ok(HttpResponse {
                status: 200,
                headers: BTreeMap::new(),
                body: Some(json!({ "ok": true })),
                body_base64: None,
                request_id: None,
                cache: None,
            })
        }
    }

    impl UpdateInstallerAdapter for RecordingUpdateInstaller {
        fn install_update(
            &self,
            request: UpdateInstallRequest,
        ) -> DesktopResult<UpdateInstallReply> {
            self.seen.lock().unwrap().push(request.clone());
            Ok(UpdateInstallReply {
                status: "installing".to_string(),
                message: "Update installer test adapter reached.".to_string(),
                path: Some(request.path),
                target_path: request.target_path,
                relaunch_required: request.relaunch,
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
    fn proxy_config_hides_password_and_applies_to_http_requests() {
        let adapter = Arc::new(ProxyRecordingHttpAdapter {
            seen_proxy: Mutex::new(None),
        });
        let secure_root = std::env::temp_dir().join(format!(
            "desktop-foundation-proxy-test-{}",
            current_time_ms()
        ));
        let core = DesktopCore::with_all_adapters(
            adapter.clone(),
            Arc::new(RecordingDesktopAdapter::new(Arc::new(Mutex::new(
                Vec::new(),
            )))),
            Arc::new(NoopFileAdapter),
            Arc::new(FileSecureStorageAdapter::with_root(secure_root)),
        );

        let saved = core
            .proxy_set_config(ProxyConfig {
                enabled: true,
                mode: ProxyMode::Http,
                host: Some("127.0.0.1".to_string()),
                port: Some(7890),
                username: Some("operator".to_string()),
                password: Some("secret".to_string()),
                bypass: vec!["localhost".to_string()],
                has_password: false,
            })
            .unwrap();
        assert!(saved.has_password);
        assert_eq!(saved.password, None);

        let config = core.proxy_get_config().unwrap();
        assert!(config.has_password);
        assert_eq!(config.password, None);

        core.http_request(HttpRequest {
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
            auth: Some(false),
            request_id: None,
            namespace: None,
            cache: None,
        })
        .unwrap();

        let seen = adapter.seen_proxy.lock().unwrap().clone().unwrap();
        assert_eq!(seen.mode, ProxyMode::Http);
        assert_eq!(seen.host.as_deref(), Some("127.0.0.1"));
        assert_eq!(seen.password.as_deref(), Some("secret"));
        assert_eq!(seen.bypass, vec!["localhost".to_string()]);

        let disabled = core
            .proxy_set_config(ProxyConfig {
                enabled: false,
                mode: ProxyMode::None,
                host: None,
                port: None,
                username: None,
                password: Some("should-not-stay".to_string()),
                bypass: Vec::new(),
                has_password: true,
            })
            .unwrap();
        assert!(!disabled.has_password);
        assert!(!core.proxy_get_config().unwrap().has_password);
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
                cache: None,
            })
            .unwrap();

        assert_eq!(reply.status, 200);
        assert_eq!(
            *adapter.seen_token.lock().unwrap(),
            Some("admin-token".to_string())
        );
    }

    #[test]
    fn http_request_cache_hits_inside_desktop_core() {
        let adapter = Arc::new(CountingHttpAdapter {
            calls: Mutex::new(0),
            fail_after_first: false,
        });
        let core = DesktopCore::with_http_adapter(adapter.clone());
        let cache = Some(HttpCacheOptions {
            key: Some("demo:languages".to_string()),
            ttl_ms: 60_000,
            storage: Some(HttpCacheStorage::Memory),
            refresh: None,
            stale_if_error: None,
        });

        let first = core
            .http_request(HttpRequest {
                method: HttpMethod::Get,
                url: "https://example.test/languages".to_string(),
                headers: BTreeMap::new(),
                query: BTreeMap::new(),
                body: None,
                body_base64: None,
                body_content_type: None,
                multipart: None,
                response_type: None,
                timeout_ms: None,
                auth: Some(false),
                request_id: Some("first".to_string()),
                namespace: Some("demo".to_string()),
                cache: cache.clone(),
            })
            .unwrap();
        let second = core
            .http_request(HttpRequest {
                method: HttpMethod::Get,
                url: "https://example.test/languages".to_string(),
                headers: BTreeMap::new(),
                query: BTreeMap::new(),
                body: None,
                body_base64: None,
                body_content_type: None,
                multipart: None,
                response_type: None,
                timeout_ms: None,
                auth: Some(false),
                request_id: Some("second".to_string()),
                namespace: Some("demo".to_string()),
                cache,
            })
            .unwrap();

        assert_eq!(first.body, Some(json!({ "count": 1 })));
        assert_eq!(second.body, Some(json!({ "count": 1 })));
        assert_eq!(second.request_id, Some("second".to_string()));
        assert_eq!(second.cache.as_ref().map(|cache| cache.hit), Some(true));
        assert_eq!(*adapter.calls.lock().unwrap(), 1);
    }

    #[test]
    fn http_request_cache_can_return_stale_response_after_transport_error() {
        let adapter = Arc::new(CountingHttpAdapter {
            calls: Mutex::new(0),
            fail_after_first: true,
        });
        let core = DesktopCore::with_http_adapter(adapter.clone());
        let mut cache = HttpCacheOptions {
            key: Some("demo:stale".to_string()),
            ttl_ms: 1,
            storage: Some(HttpCacheStorage::Memory),
            refresh: None,
            stale_if_error: Some(true),
        };

        core.http_request(HttpRequest {
            method: HttpMethod::Get,
            url: "https://example.test/stale".to_string(),
            headers: BTreeMap::new(),
            query: BTreeMap::new(),
            body: None,
            body_base64: None,
            body_content_type: None,
            multipart: None,
            response_type: None,
            timeout_ms: None,
            auth: Some(false),
            request_id: Some("prime".to_string()),
            namespace: Some("demo".to_string()),
            cache: Some(cache.clone()),
        })
        .unwrap();
        std::thread::sleep(Duration::from_millis(2));
        cache.refresh = Some(true);
        let stale = core
            .http_request(HttpRequest {
                method: HttpMethod::Get,
                url: "https://example.test/stale".to_string(),
                headers: BTreeMap::new(),
                query: BTreeMap::new(),
                body: None,
                body_base64: None,
                body_content_type: None,
                multipart: None,
                response_type: None,
                timeout_ms: None,
                auth: Some(false),
                request_id: Some("stale".to_string()),
                namespace: Some("demo".to_string()),
                cache: Some(cache),
            })
            .unwrap();

        assert_eq!(stale.body, Some(json!({ "count": 1 })));
        assert_eq!(stale.cache.as_ref().map(|cache| cache.hit), Some(true));
        assert_eq!(stale.cache.as_ref().map(|cache| cache.stale), Some(true));
        assert_eq!(*adapter.calls.lock().unwrap(), 2);
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
        let core =
            DesktopCore::with_http_adapter(adapter.clone()).with_security_policy(SecurityPolicy {
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
                cache: None,
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

    #[test]
    fn update_install_delegates_to_configured_adapter() {
        let path = std::env::temp_dir().join(format!(
            "desktop-foundation-test-{}-update.zip",
            std::process::id()
        ));
        std::fs::write(&path, "update").unwrap();
        let adapter = Arc::new(RecordingUpdateInstaller {
            seen: Mutex::new(Vec::new()),
        });
        let core = DesktopCore::new().with_update_installer_adapter(adapter.clone());

        let reply = core
            .install_update(UpdateInstallRequest {
                path: path.to_string_lossy().to_string(),
                target_path: Some("/Applications/Desktop Foundation Test.app".to_string()),
                app_name: Some("Desktop Foundation Test".to_string()),
                relaunch: true,
                backup: false,
            })
            .unwrap();

        assert_eq!(reply.status, "installing");
        assert_eq!(reply.path, Some(path.to_string_lossy().to_string()));
        let seen = adapter.seen.lock().unwrap();
        assert_eq!(seen.len(), 1);
        assert_eq!(
            seen[0].app_name,
            Some("Desktop Foundation Test".to_string())
        );
        assert!(!seen[0].backup);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn update_install_blocks_unallowed_paths_before_adapter() {
        let root = std::env::temp_dir().join(format!(
            "desktop-foundation-test-{}-allowed",
            std::process::id()
        ));
        let outside = std::env::temp_dir().join(format!(
            "desktop-foundation-test-{}-blocked-update.zip",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&root);
        std::fs::write(&outside, "update").unwrap();
        let adapter = Arc::new(RecordingUpdateInstaller {
            seen: Mutex::new(Vec::new()),
        });
        let core = DesktopCore::new()
            .with_update_installer_adapter(adapter.clone())
            .with_security_policy(SecurityPolicy {
                allowed_file_roots: vec![root.to_string_lossy().to_string()],
                ..SecurityPolicy::default()
            });

        let error = core
            .install_update(UpdateInstallRequest {
                path: outside.to_string_lossy().to_string(),
                target_path: None,
                app_name: None,
                relaunch: false,
                backup: true,
            })
            .unwrap_err();

        assert_eq!(error.code, "FILE_PATH_BLOCKED");
        assert!(adapter.seen.lock().unwrap().is_empty());
        let _ = std::fs::remove_file(&outside);
        let _ = std::fs::remove_dir_all(&root);
    }
}
