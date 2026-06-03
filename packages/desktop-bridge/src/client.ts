import { createWebSessionStore, createWebStorage } from "./storage";
import { createWebDesktopCapability } from "./desktop";
import { createWebFileCapability } from "./files";
import { createWebSecureStorage } from "./secureStorage";
import { createManifestUpdateCapability } from "./updates";
import type { DesktopCapability, DesktopClient, DesktopClientConfig, FileCapability, HttpMethod, HttpRequestOptions, RequestLogEntry, SessionStore } from "./types";
import { createWebTransport } from "./webTransport";
import { DesktopError, UnauthorizedError } from "./errors";

function joinURL(baseURL: string, path: string) {
  const base = baseURL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function originAllowed(url: string, patterns: string[] | undefined) {
  if (!patterns?.length) return true;
  const parsed = new URL(url, window.location.href);
  const origin = parsed.origin.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  return patterns.some((pattern) => {
    const normalized = pattern.toLowerCase().replace(/\/$/, "");
    if (normalized === "*") return true;
    if (normalized.includes("://")) return normalized === origin;
    if (normalized.startsWith("*.")) {
      const suffix = normalized.slice(2);
      return host === suffix || host.endsWith(`.${suffix}`);
    }
    return normalized === host;
  });
}

function schemeAllowed(url: string, schemes: string[] | undefined) {
  if (!schemes?.length) return true;
  const parsed = new URL(url, window.location.href);
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  return schemes.some((item) => item.toLowerCase() === scheme);
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function pathAllowed(path: string | undefined, roots: string[] | undefined) {
  if (!path || !roots?.length) return true;
  const normalized = normalizePath(path);
  return roots.some((root) => {
    const normalizedRoot = normalizePath(root);
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  });
}

function assertRequestAllowed(config: DesktopClientConfig, url: string) {
  if (!originAllowed(url, config.security?.allowedRequestOrigins)) {
    throw new DesktopError({
      code: "REQUEST_ORIGIN_BLOCKED",
      message: "Request origin is not allowed",
      details: { url }
    });
  }
}

function wrapDesktopCapability(desktop: DesktopCapability, config: DesktopClientConfig): DesktopCapability {
  return {
    ...desktop,
    openExternal: async (url: string) => {
      if (!schemeAllowed(url, config.security?.allowedExternalSchemes) || !originAllowed(url, config.security?.allowedExternalOrigins)) {
        throw new DesktopError({
          code: "EXTERNAL_URL_BLOCKED",
          message: "External URL is not allowed",
          details: { url }
        });
      }
      await desktop.openExternal(url);
    }
  };
}

function wrapFileCapability(files: FileCapability, config: DesktopClientConfig, session: SessionStore): FileCapability {
  return {
    ...files,
    openFileDialog: async (options) => {
      if (!pathAllowed(options?.directory, config.security?.allowedDownloadDirectories)) {
        throw new DesktopError({ code: "FILE_DIRECTORY_BLOCKED", message: "File dialog directory is not allowed" });
      }
      return files.openFileDialog(options);
    },
    saveFileDialog: async (options) => {
      if (!pathAllowed(options?.directory, config.security?.allowedDownloadDirectories)) {
        throw new DesktopError({ code: "FILE_DIRECTORY_BLOCKED", message: "File dialog directory is not allowed" });
      }
      return files.saveFileDialog(options);
    },
    writeTextFile: async (path, content, options) => {
      if (!pathAllowed(path, config.security?.allowedDownloadDirectories)) {
        throw new DesktopError({ code: "FILE_PATH_BLOCKED", message: "File path is not allowed" });
      }
      return files.writeTextFile(path, content, options);
    },
    exportJson: async (fileName, data, options) => {
      if (!pathAllowed(options?.directory, config.security?.allowedDownloadDirectories)) {
        throw new DesktopError({ code: "FILE_DIRECTORY_BLOCKED", message: "Export directory is not allowed" });
      }
      return files.exportJson(fileName, data, options);
    },
    downloadFile: async (url, options = {}) => {
      assertRequestAllowed(config, url);
      if (!pathAllowed(options.path ?? options.directory, config.security?.allowedDownloadDirectories)) {
        throw new DesktopError({ code: "DOWNLOAD_PATH_BLOCKED", message: "Download path is not allowed" });
      }
      const token = options.auth === false ? null : session.getToken();
      const headers = { ...options.headers };
      if (token && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
        headers.Authorization = `Bearer ${token}`;
      }
      return files.downloadFile(url, { ...options, headers });
    }
  };
}

export function createDesktopClient(config: DesktopClientConfig): DesktopClient {
  const tokenKey = config.tokenKey ?? `${config.product}:desktop:token`;
  const session = config.session ?? createWebSessionStore(tokenKey);
  const storage = config.storage ?? createWebStorage(window.localStorage);
  const secureStorage = config.secureStorage ?? createWebSecureStorage(`${config.product}:desktop:secure`);
  const transport = config.transport ?? createWebTransport();
  const desktop = wrapDesktopCapability(config.desktop ?? createWebDesktopCapability(), config);
  const files = wrapFileCapability(config.files ?? createWebFileCapability(), config, session);
  const assertUpdateManifestUrl = config.updateConfig?.assertManifestUrl;
  const updateConfig = {
    ...config.updateConfig,
    currentVersion: config.updateConfig?.currentVersion ?? config.version,
    transport: config.updateConfig?.transport ?? transport,
    assertManifestUrl: (url: string) => {
      assertUpdateManifestUrl?.(url);
      assertRequestAllowed(config, url);
    }
  };
  const updates = config.updates ?? createManifestUpdateCapability(updateConfig, desktop, files);
  const recentRequests: RequestLogEntry[] = [];
  const maxRequestLogEntries = config.maxRequestLogEntries ?? 50;

  function rememberRequest(entry: RequestLogEntry) {
    const existingIndex = recentRequests.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
      recentRequests[existingIndex] = entry;
    } else {
      recentRequests.unshift(entry);
    }
    if (recentRequests.length > maxRequestLogEntries) {
      recentRequests.splice(maxRequestLogEntries);
    }
  }

  function makeRequestId() {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function normalizeError(error: unknown): RequestLogEntry["error"] {
    if (error && typeof error === "object") {
      const candidate = error as { name?: string; message?: string; code?: string; status?: number; details?: unknown };
      return {
        name: candidate.name,
        message: candidate.message || "Request failed",
        code: candidate.code,
        status: candidate.status
      };
    }
    return { message: String(error || "Request failed") };
  }

  async function request<T>(method: HttpMethod, path: string, bodyOrOptions?: unknown, maybeOptions?: HttpRequestOptions) {
    const options = method === "GET" || method === "DELETE" ? (bodyOrOptions as HttpRequestOptions | undefined) : maybeOptions;
    const body = method === "GET" || method === "DELETE" ? undefined : bodyOrOptions;
    const token = options?.auth === false ? null : session.getToken();
    const url = joinURL(config.apiBaseURL, path);
    assertRequestAllowed(config, url);
    const startedAt = Date.now();
    const entry: RequestLogEntry = {
      id: options?.requestId ?? makeRequestId(),
      requestId: options?.requestId,
      method,
      url,
      namespace: options?.namespace ?? config.product,
      startedAt
    };
    entry.requestId = entry.id;
    rememberRequest(entry);
    config.requestObserver?.onRequestStart?.(entry);

    try {
      const result = await transport.request<T>({
        ...options,
        requestId: entry.id,
        namespace: entry.namespace,
        method,
        url,
        headers: {
          ...config.defaultHeaders,
          ...options?.headers
        },
        body,
        token
      });
      const endedAt = Date.now();
      const nextEntry = { ...entry, endedAt, durationMs: endedAt - startedAt, ok: true };
      rememberRequest(nextEntry);
      config.requestObserver?.onRequestEnd?.(nextEntry);
      return result;
    } catch (error) {
      const endedAt = Date.now();
      const nextEntry = {
        ...entry,
        endedAt,
        durationMs: endedAt - startedAt,
        ok: false,
        error: normalizeError(error)
      };
      nextEntry.status = nextEntry.error?.status;
      rememberRequest(nextEntry);
      config.requestObserver?.onRequestEnd?.(nextEntry);
      if (error instanceof UnauthorizedError || nextEntry.error?.status === 401 || nextEntry.error?.code === "UNAUTHORIZED") {
        config.requestObserver?.onUnauthorized?.(nextEntry);
        config.onUnauthorized?.(nextEntry);
      }
      throw error;
    }
  }

  return {
    http: {
      get: <T>(path: string, options?: HttpRequestOptions) => request<T>("GET", path, options),
      post: <T>(path: string, body?: unknown, options?: HttpRequestOptions) => request<T>("POST", path, body, options),
      put: <T>(path: string, body?: unknown, options?: HttpRequestOptions) => request<T>("PUT", path, body, options),
      patch: <T>(path: string, body?: unknown, options?: HttpRequestOptions) => request<T>("PATCH", path, body, options),
      delete: <T>(path: string, options?: HttpRequestOptions) => request<T>("DELETE", path, options)
    },
    session,
    storage,
    secureStorage,
    desktop,
    files,
    updates,
    diagnostics: {
      getRecentRequests: () => recentRequests.slice(),
      clearRecentRequests: () => {
        recentRequests.splice(0);
      }
    }
  };
}
