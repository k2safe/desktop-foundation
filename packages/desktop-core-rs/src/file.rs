use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DialogFilter {
    pub name: String,
    #[serde(default)]
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenFileDialogRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub directory: Option<String>,
    #[serde(default)]
    pub filters: Vec<DialogFilter>,
    #[serde(default)]
    pub multiple: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileDialogReply {
    #[serde(default)]
    pub paths: Vec<String>,
    pub canceled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileDialogRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub directory: Option<String>,
    #[serde(default)]
    pub default_file_name: Option<String>,
    #[serde(default)]
    pub filters: Vec<DialogFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileDialogReply {
    #[serde(default)]
    pub path: Option<String>,
    pub canceled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextFileReply {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileRequest {
    pub path: String,
    pub content: String,
    #[serde(default = "default_true")]
    pub create_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WriteBinaryFileRequest {
    pub path: String,
    pub content_base64: String,
    #[serde(default = "default_true")]
    pub create_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportJsonRequest {
    pub file_name: String,
    pub data: Value,
    #[serde(default)]
    pub directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFileRequest {
    pub url: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub directory: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    #[serde(default)]
    pub query: BTreeMap<String, Value>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub auth: Option<bool>,
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub namespace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FilePathReply {
    pub path: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFileReply {
    pub path: String,
    pub bytes: u64,
    pub status: u16,
    #[serde(default)]
    pub request_id: Option<String>,
}

fn default_true() -> bool {
    true
}
