use serde::{Deserialize, Serialize};

use crate::error::{DesktopError, DesktopResult};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProxyMode {
    None,
    System,
    Http,
    Socks5,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub mode: ProxyMode,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default)]
    pub bypass: Vec<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub has_password: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestRequest {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestResult {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl Default for ProxyMode {
    fn default() -> Self {
        Self::None
    }
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: ProxyMode::None,
            host: None,
            port: None,
            username: None,
            password: None,
            bypass: Vec::new(),
            has_password: false,
        }
    }
}

impl ProxyConfig {
    pub fn without_password(mut self, has_password: bool) -> Self {
        self.password = None;
        self.has_password = has_password;
        self
    }

    pub fn for_persistence(mut self) -> Self {
        self.password = None;
        self.has_password = false;
        self
    }

    pub fn is_direct(&self) -> bool {
        !self.enabled || self.mode == ProxyMode::None
    }

    pub fn uses_explicit_proxy(&self) -> bool {
        self.enabled && matches!(self.mode, ProxyMode::Http | ProxyMode::Socks5)
    }

    pub fn proxy_url(&self) -> DesktopResult<Option<String>> {
        if self.is_direct() || self.mode == ProxyMode::System {
            return Ok(None);
        }

        let scheme = match self.mode {
            ProxyMode::Http => "http",
            ProxyMode::Socks5 => "socks5",
            ProxyMode::None | ProxyMode::System => return Ok(None),
        };
        let host = self
            .host
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| DesktopError::new("PROXY_HOST_REQUIRED", "Proxy host is required"))?;
        let port = self
            .port
            .filter(|value| *value > 0)
            .ok_or_else(|| DesktopError::new("PROXY_PORT_REQUIRED", "Proxy port is required"))?;
        let auth = self
            .username
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|username| {
                let username = percent_encode_userinfo(username);
                let password = self
                    .password
                    .as_deref()
                    .map(percent_encode_userinfo)
                    .unwrap_or_default();
                format!("{username}:{password}@")
            })
            .unwrap_or_default();
        Ok(Some(format!("{scheme}://{auth}{host}:{port}")))
    }

    pub fn bypass_list(&self) -> Option<String> {
        let values = self
            .bypass
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        if values.is_empty() {
            None
        } else {
            Some(values.join(","))
        }
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

fn percent_encode_userinfo(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect::<String>()
}
