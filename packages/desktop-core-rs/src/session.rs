use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionGetRequest {
    pub namespace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionSetRequest {
    pub namespace: String,
    pub token: String,
    #[serde(default)]
    pub remember: bool,
    #[serde(default)]
    pub user: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionClearRequest {
    pub namespace: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub remember: bool,
    #[serde(default)]
    pub user: Option<Value>,
}
