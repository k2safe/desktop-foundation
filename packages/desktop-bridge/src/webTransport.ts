import { DesktopError, UnauthorizedError } from "./errors";
import type { HttpMultipartForm, HttpTransport, HttpTransportRequest, QueryParams } from "./types";

function withQuery(url: string, query?: QueryParams) {
  const target = new URL(url);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, String(value));
    }
  });
  return target.toString();
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function base64FromArrayBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function multipartToFormData(multipart?: HttpMultipartForm) {
  if (!multipart || (!multipart.fields?.length && !multipart.files?.length)) return undefined;
  const formData = new FormData();
  multipart.fields?.forEach((field) => {
    formData.append(field.name, field.value);
  });
  multipart.files?.forEach((file) => {
    const blob = new Blob([bytesFromBase64(file.bodyBase64)], { type: file.contentType });
    formData.append(file.name, blob, file.fileName);
  });
  return formData;
}

function headersToRecord(headers: Headers) {
  const values: Record<string, string> = {};
  headers.forEach((value, key) => {
    values[key] = value;
  });
  return values;
}

export function createWebTransport(): HttpTransport {
  return {
    async request<T>({
      method,
      url,
      headers,
      query,
      body,
      bodyBase64,
      bodyContentType,
      multipart,
      responseType = "json",
      timeoutMs,
      token,
      signal,
      onResponse
    }: HttpTransportRequest) {
      const requestHeaders = new Headers(headers);
      const multipartBody = multipartToFormData(multipart);
      const formBody = multipartBody ?? (isFormData(body) ? body : undefined);
      if (token && !requestHeaders.has("Authorization")) {
        requestHeaders.set("Authorization", `Bearer ${token}`);
      }
      if (bodyBase64 && bodyContentType && !requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", bodyContentType);
      } else if (body !== undefined && !formBody && !requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }

      let response: Response;
      const controller = timeoutMs ? new AbortController() : null;
      const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
      if (signal && controller) {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      try {
        response = await fetch(withQuery(url, query), {
          method,
          headers: requestHeaders,
          body: bodyBase64 ? bytesFromBase64(bodyBase64) : formBody ?? (body === undefined ? body : JSON.stringify(body)),
          signal: controller?.signal ?? signal
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new DesktopError({
          code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
          message: error instanceof Error ? error.message : aborted ? "Request timed out" : "Network error",
          kind: aborted ? "timeout" : "network",
          retryable: true,
          details: error,
          cause: error
        });
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }

      const payload =
        responseType === "base64"
          ? await response.arrayBuffer().then(base64FromArrayBuffer)
          : responseType === "text"
            ? await response.text()
            : await parseBody(response);
      const requestId = response.headers.get("x-request-id") ?? undefined;
      onResponse?.({
        status: response.status,
        headers: headersToRecord(response.headers),
        requestId
      });

      if (response.status === 401) {
        throw new UnauthorizedError(typeof payload === "object" && payload ? payload.message || "Unauthorized" : "Unauthorized", requestId);
      }

      if (!response.ok) {
        throw new DesktopError({
          code: String(typeof payload === "object" && payload ? payload.code || response.status : response.status),
          message: typeof payload === "object" && payload ? payload.message || payload.msg || `HTTP ${response.status}` : `HTTP ${response.status}`,
          status: response.status,
          requestId,
          kind: typeof payload === "object" && payload ? payload.kind || payload.errorKind : undefined,
          retryable: typeof payload === "object" && payload && typeof payload.retryable === "boolean" ? payload.retryable : undefined,
          details: payload
        });
      }

      if (payload && typeof payload === "object" && typeof payload.code !== "undefined") {
        const ok = payload.code === 200 || String(payload.code) === "200" || String(payload.code) === "000000";
        if (!ok) {
          throw new DesktopError({
            code: String(payload.code),
            message: payload.message || payload.msg || "Request failed",
            status: response.status,
            requestId,
            kind: payload.kind || payload.errorKind,
            retryable: typeof payload.retryable === "boolean" ? payload.retryable : undefined,
            details: payload
          });
        }
        return payload.data as T;
      }

      return payload as T;
    }
  };
}
