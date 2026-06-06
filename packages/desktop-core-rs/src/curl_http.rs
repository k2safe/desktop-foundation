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
use crate::http::{HttpMethod, HttpMultipartForm, HttpRequest, HttpResponse, HttpResponseType};
use crate::proxy::{ProxyConfig, ProxyMode};
use crate::session::SessionState;

#[derive(Clone, Default)]
pub struct CurlHttpAdapter;

impl HttpAdapter for CurlHttpAdapter {
    fn request(
        &self,
        request: HttpRequest,
        session: Option<SessionState>,
        proxy: Option<ProxyConfig>,
    ) -> DesktopResult<HttpResponse> {
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
        apply_proxy_args(&mut command, proxy.as_ref())?;

        let is_multipart = request
            .multipart
            .as_ref()
            .is_some_and(|multipart| !multipart.is_empty());
        let mut has_authorization = request
            .headers
            .keys()
            .any(|key| key.eq_ignore_ascii_case("authorization"));
        for (key, value) in &request.headers {
            if is_multipart && key.eq_ignore_ascii_case("content-type") {
                continue;
            }
            command.args(["-H", &format!("{key}: {value}")]);
        }

        if request.auth != Some(false) && !has_authorization {
            if let Some(token) = session.and_then(|state| state.token) {
                command.args(["-H", &format!("Authorization: Bearer {token}")]);
                has_authorization = true;
            }
        }
        let _ = has_authorization;

        if let Some(multipart) = request.multipart.filter(|multipart| !multipart.is_empty()) {
            for arg in multipart_args(multipart, &temp)? {
                command.arg(arg);
            }
        } else if let Some(body_base64) = request.body_base64 {
            let bytes = general_purpose::STANDARD
                .decode(body_base64)
                .map_err(|error| {
                    DesktopError::new(
                        "HTTP_BODY_BASE64_DECODE_FAILED",
                        "Failed to decode HTTP request body",
                    )
                    .with_details(Value::String(error.to_string()))
                })?;
            fs::write(&temp.request_body, bytes).map_err(|error| {
                DesktopError::new(
                    "HTTP_BODY_WRITE_FAILED",
                    "Failed to write temporary HTTP body",
                )
                .with_details(Value::String(error.to_string()))
            })?;
            if let Some(content_type) = request.body_content_type {
                command.args(["-H", &format!("Content-Type: {content_type}")]);
            }
            command.arg("--data-binary");
            command.arg(format!("@{}", temp.request_body.to_string_lossy()));
        } else if let Some(body) = request.body {
            let text = serde_json::to_string(&body).map_err(|error| {
                DesktopError::new(
                    "HTTP_BODY_SERIALIZE_FAILED",
                    "Failed to serialize HTTP request body",
                )
                .with_details(Value::String(error.to_string()))
            })?;
            fs::write(&temp.request_body, text).map_err(|error| {
                DesktopError::new(
                    "HTTP_BODY_WRITE_FAILED",
                    "Failed to write temporary HTTP body",
                )
                .with_details(Value::String(error.to_string()))
            })?;
            command.args(["-H", "Content-Type: application/json"]);
            command.arg("--data-binary");
            command.arg(format!("@{}", temp.request_body.to_string_lossy()));
        }

        command.arg(url);
        let output = command.output().map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                DesktopError::new(
                    "HTTP_CURL_UNAVAILABLE",
                    "curl is not available for HTTPS transport",
                )
            } else {
                DesktopError::new("HTTP_CURL_FAILED", "Failed to execute curl")
                    .with_details(Value::String(error.to_string()))
            }
        })?;
        if !output.status.success() {
            let mut error = DesktopError::new("HTTP_CURL_FAILED", "curl request failed")
                .with_details(Value::String(
                    String::from_utf8_lossy(&output.stderr).to_string(),
                ));
            if let Some(request_id) = request_id {
                error = error.with_request_id(request_id);
            }
            return Err(error);
        }

        let header_text = fs::read_to_string(&temp.headers).map_err(|error| {
            DesktopError::new("HTTP_HEADER_READ_FAILED", "Failed to read HTTP headers")
                .with_details(Value::String(error.to_string()))
        })?;
        let body_bytes = fs::read(&temp.body).map_err(|error| {
            DesktopError::new("HTTP_BODY_READ_FAILED", "Failed to read HTTP body")
                .with_details(Value::String(error.to_string()))
        })?;
        let (status, headers) = parse_headers(&header_text)?;
        let response_request_id = headers
            .iter()
            .find(|(key, _value)| key.eq_ignore_ascii_case("x-request-id"))
            .map(|(_key, value)| value.clone())
            .or(request_id);
        let response_type = request.response_type.unwrap_or(HttpResponseType::Json);
        let (body, body_base64) = parse_body(body_bytes, &response_type);

        if !(200..300).contains(&status) {
            let mut error =
                DesktopError::new("HTTP_ERROR", format!("HTTP {status}")).with_status(status);
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
            cache: None,
        })
    }
}

fn apply_proxy_args(command: &mut Command, proxy: Option<&ProxyConfig>) -> DesktopResult<()> {
    let Some(proxy) = proxy else {
        return Ok(());
    };

    if proxy.is_direct() {
        command.args(["--noproxy", "*"]);
        return Ok(());
    }

    if let Some(bypass) = proxy.bypass_list() {
        command.args(["--noproxy", &bypass]);
    }

    match proxy.mode {
        ProxyMode::System => Ok(()),
        ProxyMode::Http | ProxyMode::Socks5 => {
            if let Some(url) = proxy.proxy_url()? {
                command.args(["--proxy", &url]);
            }
            Ok(())
        }
        ProxyMode::None => Ok(()),
    }
}

struct CurlTempFiles {
    headers: PathBuf,
    body: PathBuf,
    request_body: PathBuf,
    base: PathBuf,
}

impl CurlTempFiles {
    fn new() -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or_default();
        let base = std::env::temp_dir().join(format!(
            "desktop-foundation-curl-{}-{stamp}",
            std::process::id()
        ));
        Self {
            headers: base.with_extension("headers"),
            body: base.with_extension("body"),
            request_body: base.with_extension("request"),
            base,
        }
    }

    fn multipart_file(&self, index: usize) -> PathBuf {
        self.base.with_extension(format!("multipart-{index}"))
    }
}

impl Drop for CurlTempFiles {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.headers);
        let _ = fs::remove_file(&self.body);
        let _ = fs::remove_file(&self.request_body);
        for index in 0..256 {
            let path = self.multipart_file(index);
            if !path.exists() {
                break;
            }
            let _ = fs::remove_file(path);
        }
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
                Some(format!(
                    "{}={}",
                    percent_encode(key),
                    percent_encode(&value)
                ))
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
    let status = status.ok_or_else(|| {
        DesktopError::new(
            "HTTP_STATUS_PARSE_FAILED",
            "Failed to parse HTTP response status",
        )
    })?;
    Ok((status, headers))
}

fn parse_body(bytes: Vec<u8>, response_type: &HttpResponseType) -> (Option<Value>, Option<String>) {
    if bytes.is_empty() {
        return (None, None);
    }
    match response_type {
        HttpResponseType::Base64 => (None, Some(general_purpose::STANDARD.encode(bytes))),
        HttpResponseType::Text => (
            Some(Value::String(String::from_utf8_lossy(&bytes).to_string())),
            None,
        ),
        HttpResponseType::Json => {
            let text = String::from_utf8_lossy(&bytes).to_string();
            (
                Some(serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text))),
                None,
            )
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
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect::<String>()
}

fn validate_multipart_name(value: &str) -> DesktopResult<&str> {
    if value.is_empty() || value.contains(['=', '\r', '\n']) {
        return Err(DesktopError::new(
            "HTTP_MULTIPART_NAME_INVALID",
            "Invalid multipart field name",
        )
        .with_details(Value::String(value.to_string())));
    }
    Ok(value)
}

fn multipart_args(
    multipart: HttpMultipartForm,
    temp: &CurlTempFiles,
) -> DesktopResult<Vec<String>> {
    let mut args = Vec::new();
    for field in multipart.fields {
        let name = validate_multipart_name(&field.name)?;
        args.push("--form-string".to_string());
        args.push(format!("{name}={}", field.value));
    }
    for (index, file) in multipart.files.into_iter().enumerate() {
        let name = validate_multipart_name(&file.name)?;
        let bytes = general_purpose::STANDARD
            .decode(&file.body_base64)
            .map_err(|error| {
                DesktopError::new(
                    "HTTP_MULTIPART_FILE_BASE64_DECODE_FAILED",
                    "Failed to decode multipart file body",
                )
                .with_details(Value::String(error.to_string()))
            })?;
        let file_path = temp.multipart_file(index);
        fs::write(&file_path, bytes).map_err(|error| {
            DesktopError::new(
                "HTTP_MULTIPART_FILE_WRITE_FAILED",
                "Failed to write temporary multipart file",
            )
            .with_details(Value::String(error.to_string()))
        })?;
        args.push("--form".to_string());
        let mut form = format!(
            "{name}=@{};filename={}",
            file_path.to_string_lossy(),
            sanitize_curl_form_attribute(&file.file_name)
        );
        if let Some(content_type) = file
            .content_type
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            form.push_str(";type=");
            form.push_str(&sanitize_curl_form_attribute(content_type));
        }
        args.push(form);
    }
    Ok(args)
}

fn sanitize_curl_form_attribute(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            ';' | '\r' | '\n' => '_',
            ch => ch,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;

    use base64::engine::general_purpose;
    use base64::Engine as _;
    use serde_json::Value;

    use crate::adapters::HttpAdapter;
    use crate::http::{
        HttpMethod, HttpMultipartField, HttpMultipartFile, HttpMultipartForm, HttpRequest,
    };

    use super::{multipart_args, CurlHttpAdapter, CurlTempFiles};

    #[test]
    fn multipart_args_write_file_parts_for_curl_form_upload() {
        let temp = CurlTempFiles::new();
        let args = multipart_args(
            HttpMultipartForm {
                fields: vec![HttpMultipartField {
                    name: "release".to_string(),
                    value: "0.1.20".to_string(),
                }],
                files: vec![HttpMultipartFile {
                    name: "package".to_string(),
                    file_name: "desktop.zip".to_string(),
                    content_type: Some("application/zip".to_string()),
                    body_base64: general_purpose::STANDARD.encode("zip bytes"),
                }],
            },
            &temp,
        )
        .unwrap();

        assert_eq!(args[0], "--form-string");
        assert_eq!(args[1], "release=0.1.20");
        assert_eq!(args[2], "--form");
        assert!(args[3].contains("package=@"));
        assert!(args[3].contains(";filename=desktop.zip"));
        assert!(args[3].contains(";type=application/zip"));
        assert_eq!(std::fs::read(temp.multipart_file(0)).unwrap(), b"zip bytes");
    }

    #[test]
    fn curl_multipart_upload_reaches_local_server() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (sender, receiver) = mpsc::channel();

        let server = thread::spawn(move || {
            let (mut stream, _addr) = listener.accept().unwrap();
            let mut bytes = Vec::new();
            let mut buffer = [0_u8; 4096];
            let mut content_length = None;
            let mut header_end = None;

            loop {
                let read = stream.read(&mut buffer).unwrap();
                if read == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..read]);

                if header_end.is_none() {
                    header_end = bytes
                        .windows(4)
                        .position(|window| window == b"\r\n\r\n")
                        .map(|index| index + 4);
                    if let Some(end) = header_end {
                        let headers = String::from_utf8_lossy(&bytes[..end]);
                        content_length = headers.lines().find_map(|line| {
                            let (key, value) = line.split_once(':')?;
                            if key.eq_ignore_ascii_case("content-length") {
                                value.trim().parse::<usize>().ok()
                            } else {
                                None
                            }
                        });
                    }
                }

                if let (Some(end), Some(length)) = (header_end, content_length) {
                    if bytes.len() >= end + length {
                        break;
                    }
                }
            }

            let _ = sender.send(bytes);
            let body = br#"{"code":200,"data":{"ok":true}}"#;
            stream
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
                        body.len()
                    )
                    .as_bytes(),
                )
                .unwrap();
            stream.write_all(body).unwrap();
        });

        let response = CurlHttpAdapter
            .request(
                HttpRequest {
                    method: HttpMethod::Post,
                    url: format!("http://127.0.0.1:{port}/upload"),
                    headers: BTreeMap::new(),
                    query: BTreeMap::new(),
                    body: None,
                    body_base64: None,
                    body_content_type: None,
                    multipart: Some(HttpMultipartForm {
                        fields: vec![HttpMultipartField {
                            name: "release".to_string(),
                            value: "0.1.20".to_string(),
                        }],
                        files: vec![HttpMultipartFile {
                            name: "package".to_string(),
                            file_name: "desktop-release.zip".to_string(),
                            content_type: Some("application/zip".to_string()),
                            body_base64: general_purpose::STANDARD
                                .encode("zip bytes from curl adapter"),
                        }],
                    }),
                    response_type: None,
                    timeout_ms: Some(5000),
                    auth: Some(false),
                    request_id: Some("curl-multipart-smoke".to_string()),
                    namespace: Some("multipart-demo".to_string()),
                    cache: None,
                },
                None,
                None,
            )
            .unwrap();

        server.join().unwrap();
        let request = String::from_utf8_lossy(&receiver.recv().unwrap()).to_string();

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body.and_then(|body| body.get("data").cloned()),
            Some(Value::Object(
                [("ok".to_string(), Value::Bool(true))]
                    .into_iter()
                    .collect()
            ))
        );
        assert!(request.contains("POST /upload HTTP/1.1"));
        assert!(request.contains("Content-Type: multipart/form-data; boundary="));
        assert!(request.contains("name=\"release\""));
        assert!(request.contains("0.1.20"));
        assert!(request.contains("name=\"package\""));
        assert!(request.contains("filename=\"desktop-release.zip\""));
        assert!(request.contains("application/zip"));
        assert!(request.contains("zip bytes from curl adapter"));
    }
}
