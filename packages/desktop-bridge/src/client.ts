import { createWebSessionStore, createWebStorage } from "./storage";
import { createWebDesktopCapability } from "./desktop";
import { createWebFileCapability } from "./files";
import { createWebSecureStorage } from "./secureStorage";
import { createManifestUpdateCapability } from "./updates";
import type {
  AppUpdateCapability,
  AuditEvent,
  AuditEventInput,
  DesktopCapability,
  DesktopClient,
  DesktopClientConfig,
  FileCapability,
  HttpResponseMeta,
  HttpMethod,
  HttpRequestOptions,
  LinkProxyMode,
  LinkProxyRequestOptions,
  ProxyCapability,
  ProxyConfig,
  RequestLogEntry,
  SessionStore
} from "./types";
import { createWebTransport } from "./webTransport";
import { DesktopError, UnauthorizedError, normalizeDesktopError } from "./errors";

function joinURL(baseURL: string, path: string) {
  const base = baseURL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function baseLocationHref() {
  return typeof window === "undefined" ? "http://localhost" : window.location.href;
}

function normalizeURL(url: string) {
  return new URL(url, baseLocationHref()).toString();
}

function originAllowed(url: string, patterns: string[] | undefined) {
  if (!patterns?.length) return true;
  const parsed = new URL(url, baseLocationHref());
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
  const parsed = new URL(url, baseLocationHref());
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

function assertOriginAllowed(url: string, patterns: string[] | undefined, code: string, message: string) {
  if (!originAllowed(url, patterns)) {
    throw new DesktopError({ code, message, details: { url } });
  }
}

function assertRequestAllowed(config: DesktopClientConfig, url: string) {
  assertOriginAllowed(url, config.security?.allowedRequestOrigins, "REQUEST_ORIGIN_BLOCKED", "Request origin is not allowed");
}

function sanitizedProxyConfig(config: ProxyConfig): ProxyConfig {
  const { password: _password, ...rest } = config;
  return rest;
}

function createWebProxyCapability(): ProxyCapability {
  let config: ProxyConfig = { enabled: false, mode: "none", bypass: [] };
  return {
    async getConfig() {
      return { ...config };
    },
    async setConfig(nextConfig) {
      config = sanitizedProxyConfig({
        ...nextConfig,
        bypass: nextConfig.bypass ?? [],
        hasPassword: Boolean(nextConfig.password || nextConfig.hasPassword)
      });
      return { ...config };
    },
    async clearConfig() {
      config = { enabled: false, mode: "none", bypass: [] };
    },
    async testConnection() {
      return {
        ok: !config.enabled || config.mode === "none",
        message: config.enabled && config.mode !== "none" ? "Proxy settings require the Tauri desktop bridge." : undefined
      };
    }
  };
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
  const recentRequests: RequestLogEntry[] = [];
  const recentAuditEvents: AuditEvent[] = [];
  const maxRequestLogEntries = config.maxRequestLogEntries ?? 50;
  const maxAuditEvents = config.maxAuditEvents ?? 100;
  const rawDesktop = wrapDesktopCapability(config.desktop ?? createWebDesktopCapability(), config);
  const rawFiles = wrapFileCapability(config.files ?? createWebFileCapability(), config, session);
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

  function makeAuditEventId() {
    return `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function normalizeError(error: unknown): RequestLogEntry["error"] {
    const normalized = normalizeDesktopError(error);
    return {
      name: normalized.name,
      message: normalized.message,
      code: normalized.code,
      status: normalized.status,
      kind: normalized.kind,
      retryable: normalized.retryable,
      requestId: normalized.requestId
    };
  }

  function rememberAuditEvent(event: AuditEvent) {
    recentAuditEvents.unshift(event);
    if (recentAuditEvents.length > maxAuditEvents) {
      recentAuditEvents.splice(maxAuditEvents);
    }
  }

  function recordAuditEvent(input: AuditEventInput): AuditEvent {
    const event: AuditEvent = {
      id: input.id ?? makeAuditEventId(),
      timestamp: input.timestamp ?? Date.now(),
      product: input.product ?? config.product,
      namespace: input.namespace ?? config.product,
      level: input.level ?? (input.ok === false || input.error ? "error" : "info"),
      action: input.action,
      ok: input.ok,
      message: input.message,
      target: input.target,
      requestId: input.requestId,
      metadata: input.metadata,
      error: input.error
    };
    rememberAuditEvent(event);
    config.auditObserver?.onAuditEvent?.(event);
    config.onAuditEvent?.(event);
    return event;
  }

  function auditError(error: unknown) {
    const normalized = normalizeDesktopError(error);
    return {
      name: normalized.name,
      message: normalized.message,
      code: normalized.code,
      status: normalized.status,
      kind: normalized.kind,
      retryable: normalized.retryable,
      requestId: normalized.requestId
    };
  }

  async function withAudit<T>(input: Omit<AuditEventInput, "ok" | "error">, task: () => Promise<T>, successMetadata?: (result: T) => Record<string, unknown> | undefined) {
    try {
      const result = await task();
      recordAuditEvent({
        ...input,
        ok: true,
        metadata: {
          ...(input.metadata ?? {}),
          ...(successMetadata?.(result) ?? {})
        }
      });
      return result;
    } catch (error) {
      const normalized = auditError(error);
      recordAuditEvent({
        ...input,
        level: "error",
        ok: false,
        message: normalized.message,
        error: normalized
      });
      throw error;
    }
  }

  function wrapAuditedDesktopCapability(desktop: DesktopCapability): DesktopCapability {
    return {
      ...desktop,
      openExternal: (url) =>
        withAudit(
          {
            action: "desktop.openExternal",
            target: url,
            metadata: { url }
          },
          () => desktop.openExternal(url)
        ),
      copyText: (text) =>
        withAudit(
          {
            action: "desktop.copyText",
            metadata: { length: text.length }
          },
          () => desktop.copyText(text)
        ),
      notify: (options) =>
        withAudit(
          {
            action: "desktop.notify",
            metadata: { title: options.title, hasBody: Boolean(options.body) }
          },
          () => desktop.notify(options)
        ),
      setWindowState: (state) =>
        withAudit(
          {
            action: "desktop.window.setState",
            metadata: { keys: Object.keys(state) }
          },
          () => desktop.setWindowState(state)
        ),
      setWindowTitle: (title) =>
        withAudit(
          {
            action: "desktop.window.setTitle",
            metadata: { length: title.length }
          },
          () => desktop.setWindowTitle(title)
        )
    };
  }

  function wrapAuditedFileCapability(files: FileCapability): FileCapability {
    return {
      ...files,
      openFileDialog: (options) =>
        withAudit(
          {
            action: "file.openDialog",
            target: options?.directory,
            metadata: { directory: options?.directory, multiple: options?.multiple }
          },
          () => files.openFileDialog(options),
          (result) => ({ canceled: result.canceled, count: result.paths.length })
        ),
      saveFileDialog: (options) =>
        withAudit(
          {
            action: "file.saveDialog",
            target: options?.directory,
            metadata: { directory: options?.directory, defaultFileName: options?.defaultFileName }
          },
          () => files.saveFileDialog(options),
          (result) => ({ canceled: result.canceled, selected: Boolean(result.path) })
        ),
      writeTextFile: (path, content, options) =>
        withAudit(
          {
            action: "file.writeText",
            target: path,
            metadata: { path, bytes: content.length, createDir: options?.createDir }
          },
          () => files.writeTextFile(path, content, options)
        ),
      exportJson: (fileName, data, options) =>
        withAudit(
          {
            action: "file.exportJson",
            target: fileName,
            metadata: { fileName, directory: options?.directory, itemCount: Array.isArray(data) ? data.length : undefined }
          },
          () => files.exportJson(fileName, data, options)
        ),
      downloadFile: (url, options) =>
        withAudit(
          {
            action: "file.download",
            target: url,
            requestId: options?.requestId,
            metadata: { url, fileName: options?.fileName, directory: options?.directory, path: options?.path }
          },
          () => files.downloadFile(url, options),
          (result) => ({ path: result.path, bytes: result.bytes, status: result.status, sha256: result.sha256 })
        )
    };
  }

  function wrapAuditedUpdateCapability(updates: AppUpdateCapability): AppUpdateCapability {
    return {
      ...updates,
      checkForUpdate: (options) =>
        withAudit(
          {
            action: "update.check",
            target: options?.manifestUrl,
            metadata: { manifestUrl: options?.manifestUrl, channel: options?.channel, currentVersion: options?.currentVersion }
          },
          () => updates.checkForUpdate(options),
          (result) => ({ available: result.available, version: result.update?.version })
        ),
      downloadUpdate: (update, options) =>
        withAudit(
          {
            action: "update.download",
            target: update?.downloadUrl,
            requestId: options?.requestId,
            metadata: { version: update?.version, downloadUrl: update?.downloadUrl, directory: options?.directory }
          },
          () => updates.downloadUpdate(update, options),
          (result) => ({ path: result.path, bytes: result.bytes, sha256: result.sha256 })
        ),
      installUpdate: (update) =>
        withAudit(
          {
            action: "update.install",
            metadata: { version: update?.version }
          },
          () => updates.installUpdate(update),
          (result) => ({ status: result?.status, relaunchRequired: result?.relaunchRequired })
        ),
      openUpdatePage: (update) =>
        withAudit(
          {
            action: "update.openPage",
            target: update?.releasePageUrl,
            metadata: { version: update?.version, releasePageUrl: update?.releasePageUrl }
          },
          () => updates.openUpdatePage(update)
        )
    };
  }

  function wrapAuditedProxyCapability(proxy: ProxyCapability): ProxyCapability {
    return {
      ...proxy,
      setConfig: (nextConfig) =>
        withAudit(
          {
            action: "proxy.setConfig",
            metadata: {
              enabled: nextConfig.enabled,
              mode: nextConfig.mode,
              host: nextConfig.host,
              port: nextConfig.port,
              bypassCount: nextConfig.bypass?.length ?? 0,
              hasUsername: Boolean(nextConfig.username),
              hasPassword: Boolean(nextConfig.password || nextConfig.hasPassword)
            }
          },
          () => proxy.setConfig(nextConfig),
          (result) => ({ enabled: result.enabled, mode: result.mode, hasPassword: result.hasPassword })
        ),
      clearConfig: () =>
        withAudit(
          {
            action: "proxy.clearConfig"
          },
          () => proxy.clearConfig()
        ),
      testConnection: (url) =>
        withAudit(
          {
            action: "proxy.testConnection",
            target: url,
            metadata: { url }
          },
          () => proxy.testConnection(url),
          (result) => ({ ok: result.ok, latencyMs: result.latencyMs })
        )
    };
  }

  const desktop = wrapAuditedDesktopCapability(rawDesktop);
  const files = wrapAuditedFileCapability(rawFiles);
  const updates = wrapAuditedUpdateCapability(config.updates ?? createManifestUpdateCapability(updateConfig, desktop, files));
  const proxy = wrapAuditedProxyCapability(config.proxy ?? createWebProxyCapability());

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

    let responseMeta: HttpResponseMeta | undefined;
    const onResponse = options?.onResponse;

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
        token,
        onResponse: (metadata) => {
          responseMeta = metadata;
          onResponse?.(metadata);
        }
      });
      const endedAt = Date.now();
      const nextEntry = {
        ...entry,
        requestId: responseMeta?.requestId ?? entry.requestId,
        endedAt,
        durationMs: endedAt - startedAt,
        status: responseMeta?.status,
        cache: responseMeta?.cache,
        ok: true
      };
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
      recordAuditEvent({
        action: "http.request.failed",
        level: "error",
        ok: false,
        target: url,
        requestId: nextEntry.requestId,
        message: nextEntry.error?.message,
        error: nextEntry.error,
        metadata: { method, url, status: nextEntry.status, namespace: entry.namespace }
      });
      if (error instanceof UnauthorizedError || nextEntry.error?.status === 401 || nextEntry.error?.code === "UNAUTHORIZED") {
        config.requestObserver?.onUnauthorized?.(nextEntry);
        config.onUnauthorized?.(nextEntry);
      }
      throw error;
    }
  }


  function resolveLinkProxyMode(options?: LinkProxyRequestOptions): LinkProxyMode {
    return options?.mode ?? config.linkProxy?.mode ?? (config.linkProxy?.proxyBaseURL ? "gateway" : "direct");
  }

  function resolveLinkTarget(url: string) {
    const targetUrl = normalizeURL(url);
    const targetPatterns = config.security?.allowedLinkTargetOrigins;
    if (targetPatterns?.length) {
      assertOriginAllowed(targetUrl, targetPatterns, "LINK_PROXY_TARGET_BLOCKED", "Link proxy target origin is not allowed");
    }
    return targetUrl;
  }

  function assertDirectLinkTargetPolicy(url: string) {
    if (!config.security?.allowedLinkTargetOrigins?.length) {
      throw new DesktopError({
        code: "LINK_PROXY_TARGET_POLICY_MISSING",
        message: "Direct link proxy requests require security.allowedLinkTargetOrigins"
      });
    }
    assertOriginAllowed(url, config.security.allowedLinkTargetOrigins, "LINK_PROXY_TARGET_BLOCKED", "Link proxy target origin is not allowed");
  }

  function resolveProxyBaseURL(options?: LinkProxyRequestOptions) {
    const proxyBaseURL = options?.proxyBaseURL ?? config.linkProxy?.proxyBaseURL;
    if (!proxyBaseURL) {
      throw new DesktopError({ code: "LINK_PROXY_BASE_URL_MISSING", message: "Link proxy gateway URL is not configured" });
    }
    const proxyUrl = normalizeURL(proxyBaseURL);
    assertOriginAllowed(
      proxyUrl,
      config.security?.allowedLinkProxyOrigins ?? config.security?.allowedRequestOrigins,
      "LINK_PROXY_ORIGIN_BLOCKED",
      "Link proxy gateway origin is not allowed"
    );
    return proxyUrl;
  }

  async function linkProxyRequest<T>(url: string, options: LinkProxyRequestOptions = {}) {
    const mode = resolveLinkProxyMode(options);
    const targetUrl = resolveLinkTarget(url);
    if (mode === "direct") assertDirectLinkTargetPolicy(targetUrl);

    const method = options.method ?? "GET";
    const namespace = options.namespace ?? "link-proxy";
    const startedAt = Date.now();
    const entry: RequestLogEntry = {
      id: options.requestId ?? makeRequestId(),
      requestId: options.requestId,
      method,
      url: targetUrl,
      namespace,
      startedAt
    };
    entry.requestId = entry.id;
    rememberRequest(entry);
    config.requestObserver?.onRequestStart?.(entry);

    const token = (options.auth ?? config.linkProxy?.auth ?? false) ? session.getToken() : null;

    try {
      const result = mode === "gateway"
        ? await transport.request<T>({
            method: "POST",
            url: resolveProxyBaseURL(options),
            headers: { ...config.linkProxy?.headers, ...options.proxyHeaders },
            body: {
              url: targetUrl,
              method,
              headers: options.headers,
              query: options.query,
              body: options.body,
              bodyBase64: options.bodyBase64,
              bodyContentType: options.bodyContentType,
              multipart: options.multipart,
              responseType: options.responseType,
              cache: options.cache
            },
            responseType: options.responseType,
            cache: options.cache,
            timeoutMs: options.timeoutMs,
            signal: options.signal,
            requestId: entry.id,
            namespace,
            token
          })
        : await transport.request<T>({
            method,
            url: targetUrl,
            headers: options.headers,
            query: options.query,
            body: options.body,
            bodyBase64: options.bodyBase64,
            bodyContentType: options.bodyContentType,
            multipart: options.multipart,
            responseType: options.responseType,
            cache: options.cache,
            timeoutMs: options.timeoutMs,
            signal: options.signal,
            requestId: entry.id,
            namespace,
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
      recordAuditEvent({
        action: "linkProxy.request.failed",
        level: "error",
        ok: false,
        target: targetUrl,
        requestId: nextEntry.requestId,
        message: nextEntry.error?.message,
        error: nextEntry.error,
        metadata: { method, url: targetUrl, status: nextEntry.status, namespace }
      });
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
    proxy,
    linkProxy: {
      request: linkProxyRequest,
      resolve: resolveLinkTarget,
      open: async (url: string) => {
        const targetUrl = resolveLinkTarget(url);
        await withAudit(
          {
            action: "linkProxy.open",
            target: targetUrl,
            metadata: { url: targetUrl }
          },
          () => desktop.openExternal(targetUrl)
        );
      }
    },
    diagnostics: {
      getRecentRequests: () => recentRequests.slice(),
      clearRecentRequests: () => {
        recentRequests.splice(0);
      },
      getRecentAuditEvents: () => recentAuditEvents.slice(),
      clearRecentAuditEvents: () => {
        recentAuditEvents.splice(0);
      },
      recordAuditEvent
    }
  };
}
