use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum HttpResponseType {
    Json,
    Text,
    Base64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub query: BTreeMap<String, Value>,
    #[serde(default)]
    pub body: Option<Value>,
    #[serde(default)]
    pub body_base64: Option<String>,
    #[serde(default)]
    pub body_content_type: Option<String>,
    #[serde(default)]
    pub multipart: Option<HttpMultipartForm>,
    #[serde(default)]
    pub response_type: Option<HttpResponseType>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub auth: Option<bool>,
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub namespace: Option<String>,
    #[serde(default)]
    pub cache: Option<HttpCacheOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum HttpCacheStorage {
    Memory,
    Persistent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpCacheOptions {
    #[serde(default)]
    pub key: Option<String>,
    pub ttl_ms: u64,
    #[serde(default)]
    pub storage: Option<HttpCacheStorage>,
    #[serde(default)]
    pub refresh: Option<bool>,
    #[serde(default)]
    pub stale_if_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HttpMultipartForm {
    #[serde(default)]
    pub fields: Vec<HttpMultipartField>,
    #[serde(default)]
    pub files: Vec<HttpMultipartFile>,
}

impl HttpMultipartForm {
    pub fn is_empty(&self) -> bool {
        self.fields.is_empty() && self.files.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpMultipartField {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpMultipartFile {
    pub name: String,
    pub file_name: String,
    #[serde(default)]
    pub content_type: Option<String>,
    pub body_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<Value>,
    #[serde(default)]
    pub body_base64: Option<String>,
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub cache: Option<HttpCacheMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpCacheMetadata {
    pub hit: bool,
    pub stale: bool,
    pub key: String,
    pub storage: HttpCacheStorage,
    pub stored_at: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HttpCacheEntry {
    pub status: u16,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub body: Option<Value>,
    #[serde(default)]
    pub body_base64: Option<String>,
    #[serde(default)]
    pub request_id: Option<String>,
    pub storage: HttpCacheStorage,
    pub stored_at: u64,
    pub expires_at: u64,
}
