import { DesktopError, UnauthorizedError } from "./errors";
import type { HttpTransport, HttpTransportRequest, QueryParams } from "./types";

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

export function createWebTransport(): HttpTransport {
  return {
    async request<T>({ method, url, headers, query, body, bodyBase64, bodyContentType, responseType = "json", timeoutMs, token, signal }: HttpTransportRequest) {
      const requestHeaders = new Headers(headers);
      if (token && !requestHeaders.has("Authorization")) {
        requestHeaders.set("Authorization", `Bearer ${token}`);
      }
      if (bodyBase64 && bodyContentType && !requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", bodyContentType);
      } else if (body !== undefined && !(body instanceof FormData) && !requestHeaders.has("Content-Type")) {
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
          body: bodyBase64 ? bytesFromBase64(bodyBase64) : body === undefined || body instanceof FormData ? body : JSON.stringify(body),
          signal: controller?.signal ?? signal
        });
      } catch (error) {
        throw new DesktopError({
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error",
          details: error
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

      if (response.status === 401) {
        throw new UnauthorizedError(typeof payload === "object" && payload ? payload.message || "Unauthorized" : "Unauthorized", requestId);
      }

      if (!response.ok) {
        throw new DesktopError({
          code: String(typeof payload === "object" && payload ? payload.code || response.status : response.status),
          message: typeof payload === "object" && payload ? payload.message || payload.msg || `HTTP ${response.status}` : `HTTP ${response.status}`,
          status: response.status,
          requestId,
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
            details: payload
          });
        }
        return payload.data as T;
      }

      return payload as T;
    }
  };
}
