use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{DesktopError, DesktopResult};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityPolicy {
    #[serde(default)]
    pub allowed_http_hosts: Vec<String>,
    #[serde(default)]
    pub allowed_external_hosts: Vec<String>,
    #[serde(default)]
    pub allowed_external_schemes: Vec<String>,
    #[serde(default)]
    pub allowed_file_roots: Vec<String>,
}

impl SecurityPolicy {
    pub fn validate_http_url(&self, url: &str) -> DesktopResult<()> {
        if self.allowed_http_hosts.is_empty() {
            return Ok(());
        }
        let parts = UrlParts::parse(url)?;
        if parts.scheme != "http" && parts.scheme != "https" {
            return Err(DesktopError::new("HTTP_SCHEME_BLOCKED", "HTTP request scheme is not allowed").with_details(Value::String(url.to_string())));
        }
        if host_allowed(&parts.host, &self.allowed_http_hosts) {
            Ok(())
        } else {
            Err(DesktopError::new("HTTP_HOST_BLOCKED", "HTTP request host is not allowed").with_details(Value::String(parts.host)))
        }
    }

    pub fn validate_external_url(&self, url: &str) -> DesktopResult<()> {
        if self.allowed_external_hosts.is_empty() && self.allowed_external_schemes.is_empty() {
            return Ok(());
        }
        let parts = UrlParts::parse(url)?;
        if !self.allowed_external_schemes.is_empty() && !self.allowed_external_schemes.iter().any(|scheme| scheme.eq_ignore_ascii_case(&parts.scheme)) {
            return Err(DesktopError::new("EXTERNAL_SCHEME_BLOCKED", "External URL scheme is not allowed").with_details(Value::String(parts.scheme)));
        }
        if self.allowed_external_hosts.is_empty() || host_allowed(&parts.host, &self.allowed_external_hosts) {
            Ok(())
        } else {
            Err(DesktopError::new("EXTERNAL_HOST_BLOCKED", "External URL host is not allowed").with_details(Value::String(parts.host)))
        }
    }

    pub fn validate_file_path(&self, path: &Path) -> DesktopResult<()> {
        if self.allowed_file_roots.is_empty() {
            return Ok(());
        }
        let resolved = resolve_path_for_policy(path)?;
        let allowed = self
            .allowed_file_roots
            .iter()
            .map(PathBuf::from)
            .filter_map(|root| resolve_path_for_policy(&root).ok())
            .any(|root| resolved.starts_with(root));
        if allowed {
            Ok(())
        } else {
            Err(DesktopError::new("FILE_PATH_BLOCKED", "File path is outside the allowed roots").with_details(Value::String(path.to_string_lossy().to_string())))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct UrlParts {
    scheme: String,
    host: String,
}

impl UrlParts {
    fn parse(url: &str) -> DesktopResult<Self> {
        let (scheme, rest) = url
            .split_once("://")
            .ok_or_else(|| DesktopError::new("INVALID_URL", "URL must include a scheme"))?;
        let host = rest
            .split(['/', '?', '#'])
            .next()
            .unwrap_or_default()
            .split('@')
            .last()
            .unwrap_or_default()
            .split(':')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        if scheme.is_empty() || host.is_empty() {
            return Err(DesktopError::new("INVALID_URL", "URL must include a scheme and host"));
        }
        Ok(Self {
            scheme: scheme.to_ascii_lowercase(),
            host,
        })
    }
}

fn host_allowed(host: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        let pattern = pattern.to_ascii_lowercase();
        pattern == "*" || pattern == host || pattern.strip_prefix("*.").is_some_and(|suffix| host == suffix || host.ends_with(&format!(".{suffix}")))
    })
}

fn resolve_path_for_policy(path: &Path) -> DesktopResult<PathBuf> {
    if path.exists() {
        return path.canonicalize().map_err(|error| {
            DesktopError::new("FILE_PATH_RESOLVE_FAILED", "Failed to resolve file path").with_details(Value::String(error.to_string()))
        });
    }
    if let Some(parent) = path.parent() {
        let parent = if parent.as_os_str().is_empty() { Path::new(".") } else { parent };
        let resolved_parent = parent.canonicalize().map_err(|error| {
            DesktopError::new("FILE_PATH_RESOLVE_FAILED", "Failed to resolve file path parent").with_details(Value::String(error.to_string()))
        })?;
        if let Some(name) = path.file_name() {
            return Ok(resolved_parent.join(name));
        }
    }
    std::env::current_dir()
        .map(|current| current.join(path))
        .map_err(|error| DesktopError::new("FILE_PATH_RESOLVE_FAILED", "Failed to resolve file path").with_details(Value::String(error.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_allowlist_supports_wildcards() {
        assert!(host_allowed("api.example.com", &["*.example.com".to_string()]));
        assert!(host_allowed("example.com", &["*.example.com".to_string()]));
        assert!(!host_allowed("example.net", &["*.example.com".to_string()]));
    }

    #[test]
    fn policy_blocks_unlisted_http_hosts() {
        let policy = SecurityPolicy {
            allowed_http_hosts: vec!["api.example.com".to_string()],
            ..SecurityPolicy::default()
        };
        assert!(policy.validate_http_url("https://api.example.com/orders").is_ok());
        assert!(policy.validate_http_url("https://evil.example.com/orders").is_err());
    }
}
