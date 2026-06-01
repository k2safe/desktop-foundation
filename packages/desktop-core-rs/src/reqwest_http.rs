use std::collections::BTreeMap;
use std::time::Duration;

use base64::engine::general_purpose;
use base64::Engine as _;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::Value;

use crate::adapters::HttpAdapter;
use crate::error::{DesktopError, DesktopResult};
use crate::http::{HttpMethod, HttpRequest, HttpResponse, HttpResponseType};
use crate::session::SessionState;

#[derive(Clone)]
pub struct ReqwestHttpAdapter {
    client: Client,
}

impl ReqwestHttpAdapter {
    pub fn new() -> DesktopResult<Self> {
        let client = Client::builder().build().map_err(to_desktop_error)?;
        Ok(Self { client })
    }

    pub fn with_client(client: Client) -> Self {
        Self { client }
    }
}

impl HttpAdapter for ReqwestHttpAdapter {
    fn request(&self, request: HttpRequest, session: Option<SessionState>) -> DesktopResult<HttpResponse> {
        let method = match request.method {
            HttpMethod::Get => reqwest::Method::GET,
            HttpMethod::Post => reqwest::Method::POST,
            HttpMethod::Put => reqwest::Method::PUT,
            HttpMethod::Patch => reqwest::Method::PATCH,
            HttpMethod::Delete => reqwest::Method::DELETE,
        };

        let mut headers = to_header_map(&request.headers)?;
        if request.auth != Some(false) && !has_authorization(&request.headers) {
            if let Some(token) = session.and_then(|state| state.token) {
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    HeaderValue::from_str(&format!("Bearer {token}"))
                        .map_err(|error| DesktopError::new("INVALID_AUTH_HEADER", "Invalid authorization header").with_details(Value::String(error.to_string())))?,
                );
            }
        }

        let mut url = reqwest::Url::parse(&request.url)
            .map_err(|error| DesktopError::new("INVALID_URL", "Invalid request URL").with_details(Value::String(error.to_string())))?;
        if !request.query.is_empty() {
            let mut pairs = url.query_pairs_mut();
            for (key, value) in &request.query {
                pairs.append_pair(key, &query_value_to_string(value));
            }
        }
        let mut builder = self.client.request(method, url).headers(headers);
        if let Some(timeout_ms) = request.timeout_ms {
            builder = builder.timeout(Duration::from_millis(timeout_ms));
        }
        if let Some(body_base64) = request.body_base64 {
            let bytes = general_purpose::STANDARD
                .decode(body_base64)
                .map_err(|error| DesktopError::new("HTTP_BODY_BASE64_DECODE_FAILED", "Failed to decode HTTP request body").with_details(Value::String(error.to_string())))?;
            if let Some(content_type) = request.body_content_type.as_ref() {
                builder = builder.header(reqwest::header::CONTENT_TYPE, content_type);
            }
            builder = builder.body(bytes);
        } else if let Some(body) = request.body {
            builder = builder.json(&body);
        }

        let response = builder.send().map_err(to_desktop_error)?;
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .map(|(key, value)| (key.as_str().to_string(), value.to_str().unwrap_or_default().to_string()))
            .collect::<BTreeMap<_, _>>();
        let request_id = headers
            .get("x-request-id")
            .cloned()
            .or_else(|| request.request_id.clone());
        let response_type = request.response_type.clone().unwrap_or(HttpResponseType::Json);
        let (body, body_base64) = match response_type {
            HttpResponseType::Base64 => {
                let bytes = response.bytes().map_err(to_desktop_error)?;
                (None, Some(general_purpose::STANDARD.encode(bytes)))
            }
            HttpResponseType::Text => {
                let text = response.text().map_err(to_desktop_error)?;
                if text.is_empty() {
                    (None, None)
                } else {
                    (Some(Value::String(text)), None)
                }
            }
            HttpResponseType::Json => {
                let text = response.text().map_err(to_desktop_error)?;
                if text.is_empty() {
                    (None, None)
                } else {
                    (Some(serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text))), None)
                }
            }
        };

        if !(200..300).contains(&status) {
            let mut error = DesktopError::new("HTTP_ERROR", format!("HTTP {status}")).with_status(status);
            if let Some(request_id) = request_id {
                error = error.with_request_id(request_id);
            }
            if let Some(body) = body {
                error = error.with_details(body);
            }
            return Err(error);
        }

        Ok(HttpResponse {
            status,
            headers,
            body,
            body_base64,
            request_id,
        })
    }
}

fn has_authorization(headers: &BTreeMap<String, String>) -> bool {
    headers.keys().any(|key| key.eq_ignore_ascii_case("authorization"))
}

fn to_header_map(headers: &BTreeMap<String, String>) -> DesktopResult<HeaderMap> {
    let mut map = HeaderMap::new();
    for (key, value) in headers {
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|error| DesktopError::new("INVALID_HEADER_NAME", "Invalid HTTP header name").with_details(Value::String(error.to_string())))?;
        let value = HeaderValue::from_str(value)
            .map_err(|error| DesktopError::new("INVALID_HEADER_VALUE", "Invalid HTTP header value").with_details(Value::String(error.to_string())))?;
        map.insert(name, value);
    }
    Ok(map)
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

fn to_desktop_error(error: reqwest::Error) -> DesktopError {
    let mut desktop_error = DesktopError::new("HTTP_TRANSPORT_ERROR", error.to_string());
    if let Some(status) = error.status() {
        desktop_error = desktop_error.with_status(status.as_u16());
    }
    desktop_error
}
