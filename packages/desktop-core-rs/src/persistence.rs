use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{DesktopError, DesktopResult};
use crate::http::HttpCacheEntry;
use crate::proxy::ProxyConfig;
use crate::runtime::StorageKey;
use crate::session::SessionState;
use crate::storage::StorageScope;

#[derive(Debug, Clone)]
pub struct FilePersistence {
    path: PathBuf,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    #[serde(default)]
    pub sessions: BTreeMap<String, SessionState>,
    #[serde(default)]
    pub storage: Vec<PersistedStorageEntry>,
    #[serde(default)]
    pub http_cache: BTreeMap<String, HttpCacheEntry>,
    #[serde(default)]
    pub proxy_config: ProxyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedStorageEntry {
    pub namespace: String,
    pub scope: StorageScope,
    pub key: String,
    pub value: Value,
}

impl FilePersistence {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn default_path(app_id: &str) -> DesktopResult<PathBuf> {
        let base = dirs::data_dir().ok_or_else(|| {
            DesktopError::new(
                "DATA_DIR_UNAVAILABLE",
                "Unable to resolve user data directory",
            )
        })?;
        Ok(base
            .join("desktop-foundation")
            .join(sanitize_app_id(app_id))
            .join("state.json"))
    }

    pub fn load(&self) -> DesktopResult<PersistedState> {
        if !self.path.exists() {
            return Ok(PersistedState::default());
        }
        let text = fs::read_to_string(&self.path).map_err(|error| {
            DesktopError::new(
                "PERSISTENCE_READ_FAILED",
                "Failed to read desktop core state",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        serde_json::from_str(&text).map_err(|error| {
            DesktopError::new(
                "PERSISTENCE_PARSE_FAILED",
                "Failed to parse desktop core state",
            )
            .with_details(Value::String(error.to_string()))
        })
    }

    pub fn save(&self, state: &PersistedState) -> DesktopResult<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                DesktopError::new(
                    "PERSISTENCE_DIR_FAILED",
                    "Failed to create desktop core state directory",
                )
                .with_details(Value::String(error.to_string()))
            })?;
        }
        let text = serde_json::to_string_pretty(state).map_err(|error| {
            DesktopError::new(
                "PERSISTENCE_SERIALIZE_FAILED",
                "Failed to serialize desktop core state",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        let temp_path = temp_path(&self.path);
        fs::write(&temp_path, text).map_err(|error| {
            DesktopError::new(
                "PERSISTENCE_WRITE_FAILED",
                "Failed to write desktop core state",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        fs::rename(&temp_path, &self.path).map_err(|error| {
            DesktopError::new(
                "PERSISTENCE_COMMIT_FAILED",
                "Failed to commit desktop core state",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        Ok(())
    }
}

pub(crate) fn storage_entries_to_map(
    entries: Vec<PersistedStorageEntry>,
) -> BTreeMap<StorageKey, Value> {
    entries
        .into_iter()
        .filter(|entry| entry.scope != StorageScope::Secure)
        .map(|entry| {
            (
                StorageKey {
                    namespace: entry.namespace,
                    scope: entry.scope,
                    key: entry.key,
                },
                entry.value,
            )
        })
        .collect()
}

pub(crate) fn storage_map_to_entries(
    storage: &BTreeMap<StorageKey, Value>,
) -> Vec<PersistedStorageEntry> {
    storage
        .iter()
        .filter(|(key, _value)| key.scope != StorageScope::Secure)
        .map(|(key, value)| PersistedStorageEntry {
            namespace: key.namespace.clone(),
            scope: key.scope.clone(),
            key: key.key.clone(),
            value: value.clone(),
        })
        .collect()
}

fn sanitize_app_id(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
                || character == '.'
            {
                character
            } else {
                '-'
            }
        })
        .collect();
    sanitized.trim_matches('-').to_string()
}

fn temp_path(path: &Path) -> PathBuf {
    let mut temp = path.to_path_buf();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("state.json");
    temp.set_file_name(format!("{file_name}.tmp"));
    temp
}
