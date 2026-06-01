use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose;
use base64::Engine as _;
use serde_json::Value;

use crate::adapters::HttpAdapter;
use crate::error::{DesktopError, DesktopResult};
use crate::http::{HttpMethod, HttpRequest, HttpResponse, HttpResponseType};
use crate::session::SessionState;

#[derive(Clone, Default)]
pub struct CurlHttpAdapter;

impl HttpAdapter for CurlHttpAdapter {
    fn request(&self, request: HttpRequest, session: Option<SessionState>) -> DesktopResult<HttpResponse> {
        let request_id = request.request_id.clone();
        let temp = CurlTempFiles::new();
        let url = append_query(&request.url, &request.query);
        let mut command = Command::new("curl");
        command.args(["-sS", "-L", "-X", method_name(&request.method)]);
        command.args(["-D", &temp.headers.to_string_lossy()]);
        command.args(["-o", &temp.body.to_string_lossy()]);

        if let Some(timeout_ms) = request.timeout_ms {
            command.args(["--max-time", &format!("{:.3}", timeout_ms as f64 / 1000.0)]);
        }

        let mut has_authorization = request.headers.keys().any(|key| key.eq_ignore_ascii_case("authorization"));
        for (key, value) in &request.headers {
            command.args(["-H", &format!("{key}: {value}")]);
        }

        if request.auth != Some(false) && !has_authorization {
            if let Some(token) = session.and_then(|state| state.token) {
                command.args(["-H", &format!("Authorization: Bearer {token}")]);
                has_authorization = true;
            }
        }
        let _ = has_authorization;

        if let Some(body_base64) = request.body_base64 {
            let bytes = general_purpose::STANDARD
                .decode(body_base64)
                .map_err(|error| DesktopError::new("HTTP_BODY_BASE64_DECODE_FAILED", "Failed to decode HTTP request body").with_details(Value::String(error.to_string())))?;
            fs::write(&temp.request_body, bytes).map_err(|error| {
                DesktopError::new("HTTP_BODY_WRITE_FAILED", "Failed to write temporary HTTP body").with_details(Value::String(error.to_string()))
            })?;
            if let Some(content_type) = request.body_content_type {
                command.args(["-H", &format!("Content-Type: {content_type}")]);
            }
            command.arg("--data-binary");
            command.arg(format!("@{}", temp.request_body.to_string_lossy()));
        } else if let Some(body) = request.body {
            let text = serde_json::to_string(&body).map_err(|error| {
                DesktopError::new("HTTP_BODY_SERIALIZE_FAILED", "Failed to serialize HTTP request body").with_details(Value::String(error.to_string()))
            })?;
            fs::write(&temp.request_body, text).map_err(|error| {
                DesktopError::new("HTTP_BODY_WRITE_FAILED", "Failed to write temporary HTTP body").with_details(Value::String(error.to_string()))
            })?;
            command.args(["-H", "Content-Type: application/json"]);
            command.arg("--data-binary");
            command.arg(format!("@{}", temp.request_body.to_string_lossy()));
        }

        command.arg(url);
        let output = command.output().map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                DesktopError::new("HTTP_CURL_UNAVAILABLE", "curl is not available for HTTPS transport")
            } else {
                DesktopError::new("HTTP_CURL_FAILED", "Failed to execute curl").with_details(Value::String(error.to_string()))
            }
        })?;
        if !output.status.success() {
            let mut error =
                DesktopError::new("HTTP_CURL_FAILED", "curl request failed").with_details(Value::String(String::from_utf8_lossy(&output.stderr).to_string()));
            if let Some(request_id) = request_id {
                error = error.with_request_id(request_id);
            }
            return Err(error);
        }

        let header_text = fs::read_to_string(&temp.headers)
            .map_err(|error| DesktopError::new("HTTP_HEADER_READ_FAILED", "Failed to read HTTP headers").with_details(Value::String(error.to_string())))?;
        let body_bytes = fs::read(&temp.body)
            .map_err(|error| DesktopError::new("HTTP_BODY_READ_FAILED", "Failed to read HTTP body").with_details(Value::String(error.to_string())))?;
        let (status, headers) = parse_headers(&header_text)?;
        let response_request_id = headers
            .iter()
            .find(|(key, _value)| key.eq_ignore_ascii_case("x-request-id"))
            .map(|(_key, value)| value.clone())
            .or(request_id);
        let response_type = request.response_type.unwrap_or(HttpResponseType::Json);
        let (body, body_base64) = parse_body(body_bytes, &response_type);

        if !(200..300).contains(&status) {
            let mut error = DesktopError::new("HTTP_ERROR", format!("HTTP {status}")).with_status(status);
            if let Some(request_id) = response_request_id {
                error = error.with_request_id(request_id);
            }
            if let Some(body) = body.or_else(|| body_base64.map(Value::String)) {
                error = error.with_details(body);
            }
            return Err(error);
        }

        Ok(HttpResponse {
            status,
            headers,
            body,
            body_base64,
            request_id: response_request_id,
        })
    }
}

struct CurlTempFiles {
    headers: PathBuf,
    body: PathBuf,
    request_body: PathBuf,
}

impl CurlTempFiles {
    fn new() -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or_default();
        let base = std::env::temp_dir().join(format!("desktop-foundation-curl-{}-{stamp}", std::process::id()));
        Self {
            headers: base.with_extension("headers"),
            body: base.with_extension("body"),
            request_body: base.with_extension("request"),
        }
    }
}

impl Drop for CurlTempFiles {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.headers);
        let _ = fs::remove_file(&self.body);
        let _ = fs::remove_file(&self.request_body);
    }
}

fn method_name(method: &HttpMethod) -> &'static str {
    match method {
        HttpMethod::Get => "GET",
        HttpMethod::Post => "POST",
        HttpMethod::Put => "PUT",
        HttpMethod::Patch => "PATCH",
        HttpMethod::Delete => "DELETE",
    }
}

fn append_query(url: &str, query: &BTreeMap<String, Value>) -> String {
    if query.is_empty() {
        return url.to_string();
    }
    let separator = if url.contains('?') { '&' } else { '?' };
    let pairs = query
        .iter()
        .filter_map(|(key, value)| {
            let value = query_value_to_string(value);
            if value.is_empty() {
                None
            } else {
                Some(format!("{}={}", percent_encode(key), percent_encode(&value)))
            }
        })
        .collect::<Vec<_>>()
        .join("&");
    if pairs.is_empty() {
        url.to_string()
    } else {
        format!("{url}{separator}{pairs}")
    }
}

fn parse_headers(text: &str) -> DesktopResult<(u16, BTreeMap<String, String>)> {
    let mut status = None;
    let mut headers = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim_end_matches('\r');
        if line.starts_with("HTTP/") {
            headers.clear();
            status = line
                .split_whitespace()
                .nth(1)
                .and_then(|value| value.parse::<u16>().ok());
        } else if let Some((key, value)) = line.split_once(':') {
            headers.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    let status = status.ok_or_else(|| DesktopError::new("HTTP_STATUS_PARSE_FAILED", "Failed to parse HTTP response status"))?;
    Ok((status, headers))
}

fn parse_body(bytes: Vec<u8>, response_type: &HttpResponseType) -> (Option<Value>, Option<String>) {
    if bytes.is_empty() {
        return (None, None);
    }
    match response_type {
        HttpResponseType::Base64 => (None, Some(general_purpose::STANDARD.encode(bytes))),
        HttpResponseType::Text => (Some(Value::String(String::from_utf8_lossy(&bytes).to_string())), None),
        HttpResponseType::Json => {
            let text = String::from_utf8_lossy(&bytes).to_string();
            (Some(serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text))), None)
        }
    }
}

fn query_value_to_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect::<String>()
}
