import { createDesktopClient } from "./client";
import { DesktopError, UnauthorizedError } from "./errors";
import { createManifestUpdateCapability } from "./updates";
import {
  createTauriNativeDesktopCapability,
  createTauriNativeFileCapability,
  createTauriNativeUpdateCapability,
  type TauriNativePluginAdapters
} from "./tauriPlugins";
import type {
  AsyncKeyValueStore,
  DesktopCapability,
  DesktopClient,
  DesktopClientConfig,
  DownloadFileOptions,
  DownloadFileResult,
  FileCapability,
  HttpTransport,
  HttpTransportRequest,
  KeyValueStore,
  NotifyOptions,
  SessionStore,
  StorageScope
} from "./types";

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface CoreHttpResponse<T> {
  status: number;
  headers?: Record<string, string>;
  body?: T;
  bodyBase64?: string;
  requestId?: string;
}

function normalizeCoreError(error: unknown): Error {
  if (error && typeof error === "object") {
    const candidate = error as { code?: string; message?: string; status?: number; requestId?: string; details?: unknown };
    if (candidate.status === 401 || candidate.code === "UNAUTHORIZED") {
      return new UnauthorizedError(candidate.message || "Unauthorized", candidate.requestId);
    }
    return new DesktopError({
      code: candidate.code || "TAURI_COMMAND_FAILED",
      message: candidate.message || "Tauri command failed",
      status: candidate.status,
      requestId: candidate.requestId,
      details: candidate.details ?? error
    });
  }
  return new DesktopError({
    code: "TAURI_COMMAND_FAILED",
    message: String(error || "Tauri command failed"),
    details: error
  });
}

function unwrapCoreHttpResponse<T>(response: CoreHttpResponse<unknown>, responseType?: string): T {
  const requestId = response.requestId ?? response.headers?.["x-request-id"];
  if (response.status === 401) {
    const payload = response.body as { message?: string } | undefined;
    throw new UnauthorizedError(payload?.message || "Unauthorized", requestId);
  }
  if (response.status < 200 || response.status >= 300) {
    const payload = response.body as { code?: string | number; message?: string; msg?: string } | undefined;
    throw new DesktopError({
      code: String(payload?.code || response.status),
      message: payload?.message || payload?.msg || `HTTP ${response.status}`,
      status: response.status,
      requestId,
      details: response.body
    });
  }
  if (responseType === "base64") {
    return response.bodyBase64 as T;
  }
  const payload = response.body as { code?: string | number; data?: T; message?: string; msg?: string } | T | undefined;
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = payload.code;
    const ok = code === 200 || String(code) === "200" || String(code) === "000000";
    if (!ok) {
      throw new DesktopError({
        code: String(code),
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

export function createTauriHttpTransport(invoke: TauriInvoke, command = "plugin:desktop-core|df_http_request"): HttpTransport {
  return {
    async request<T>(request: HttpTransportRequest) {
      try {
        const response = await invoke<CoreHttpResponse<T>>(command, { request });
        return unwrapCoreHttpResponse<T>(response, request.responseType);
      } catch (error) {
        throw normalizeCoreError(error);
      }
    }
  };
}

export function createTauriDesktopCapability(invoke: TauriInvoke): DesktopCapability {
  return {
    openExternal: async (url: string) => {
      await invoke("plugin:desktop-core|df_open_external", { request: { url } });
    },
    copyText: async (text: string) => {
      await invoke("plugin:desktop-core|df_copy_text", { request: { text } });
    },
    notify: async ({ title, body }: NotifyOptions) => {
      await invoke("plugin:desktop-core|df_notify", { request: { title, body } });
    },
    getWindowState: async () => {
      return invoke("plugin:desktop-core|df_window_get_state");
    },
    setWindowState: async (state) => {
      await invoke("plugin:desktop-core|df_window_set_state", { request: state });
    },
    setWindowTitle: async (title: string) => {
      await invoke("plugin:desktop-core|df_window_set_title", { request: { title } });
    }
  };
}

export function createTauriFileCapability(invoke: TauriInvoke, namespace: string): FileCapability {
  return {
    openFileDialog: async (options = {}) => invoke("plugin:desktop-core|df_file_open_dialog", { request: options }),
    saveFileDialog: async (options = {}) => invoke("plugin:desktop-core|df_file_save_dialog", { request: options }),
    readTextFile: async (path: string) => {
      const reply = await invoke<{ content: string }>("plugin:desktop-core|df_file_read_text", { request: { path } });
      return reply.content;
    },
    writeTextFile: async (path: string, content: string, options = {}) => {
      const reply = await invoke<{ path: string }>("plugin:desktop-core|df_file_write_text", {
        request: { path, content, createDir: options.createDir ?? true }
      });
      return reply.path;
    },
    exportJson: async (fileName: string, data: unknown, options = {}) => {
      const reply = await invoke<{ path: string }>("plugin:desktop-core|df_file_export_json", {
        request: { fileName, data, directory: options.directory }
      });
      return reply.path;
    },
    downloadFile: async (url: string, options: DownloadFileOptions = {}): Promise<DownloadFileResult> =>
      invoke("plugin:desktop-core|df_file_download", {
        request: {
          ...options,
          url,
          namespace: options.namespace ?? namespace
        }
      })
  };
}

export interface TauriSessionState {
  token?: string | null;
  remember?: boolean;
  user?: unknown;
}

export async function createTauriSessionStore(invoke: TauriInvoke, namespace: string): Promise<SessionStore> {
  let state: TauriSessionState = await invoke<TauriSessionState>("plugin:desktop-core|df_session_get", { request: { namespace } }).catch(() => ({}));

  return {
    getToken: () => state.token ?? null,
    setToken: (token: string, remember?: boolean) => {
      state = { ...state, token, remember: Boolean(remember) };
      void invoke("plugin:desktop-core|df_session_set", {
        request: {
          namespace,
          token,
          remember: Boolean(remember),
          user: state.user ?? null
        }
      });
    },
    clearToken: () => {
      state = { token: null, remember: false, user: null };
      void invoke("plugin:desktop-core|df_session_clear", { request: { namespace } });
    }
  };
}

export function createTauriSecureStorage(invoke: TauriInvoke, namespace: string): AsyncKeyValueStore {
  return {
    async get<T>(key: string) {
      const reply = await invoke<{ value?: T | null }>("plugin:desktop-core|df_secure_storage_get", {
        request: { namespace, key }
      });
      return reply.value ?? null;
    },
    async set<T>(key: string, value: T) {
      await invoke("plugin:desktop-core|df_secure_storage_set", {
        request: { namespace, key, value }
      });
    },
    async remove(key: string) {
      await invoke("plugin:desktop-core|df_secure_storage_remove", {
        request: { namespace, key }
      });
    }
  };
}

export function createTauriKeyValueStore(
  invoke: TauriInvoke,
  namespace: string,
  scope: StorageScope = "user",
  initialValues: Record<string, unknown> = {}
): KeyValueStore {
  const cache = new Map(Object.entries(initialValues));

  return {
    get: <T,>(key: string) => (cache.has(key) ? (cache.get(key) as T) : null),
    set: <T,>(key: string, value: T) => {
      cache.set(key, value);
      void invoke("plugin:desktop-core|df_storage_set", { request: { namespace, scope, key, value } });
    },
    remove: (key: string) => {
      cache.delete(key);
      void invoke("plugin:desktop-core|df_storage_remove", { request: { namespace, scope, key } });
    }
  };
}

export async function createTauriDesktopClient(
  invoke: TauriInvoke,
  config: Omit<DesktopClientConfig, "transport" | "session" | "desktop"> & {
    storageScope?: StorageScope;
    initialStorageValues?: Record<string, unknown>;
    nativePlugins?: TauriNativePluginAdapters;
  }
): Promise<DesktopClient> {
  const namespace = config.product;
  const session = await createTauriSessionStore(invoke, namespace);
  const commandDesktop = createTauriDesktopCapability(invoke);
  const commandFiles = createTauriFileCapability(invoke, namespace);
  const desktop = config.nativePlugins ? createTauriNativeDesktopCapability(config.nativePlugins, commandDesktop) : commandDesktop;
  const files = config.nativePlugins ? createTauriNativeFileCapability(config.nativePlugins, commandFiles) : commandFiles;
  const transport = createTauriHttpTransport(invoke);
  const hasNativeUpdates = Boolean(config.nativePlugins?.checkUpdate || config.nativePlugins?.downloadUpdate || config.nativePlugins?.installUpdate);
  const fallbackUpdates = config.updates ?? createManifestUpdateCapability(
    {
      ...config.updateConfig,
      currentVersion: config.updateConfig?.currentVersion ?? config.version,
      transport: config.updateConfig?.transport ?? transport
    },
    desktop,
    files
  );
  const updates = hasNativeUpdates && config.nativePlugins ? createTauriNativeUpdateCapability(config.nativePlugins, fallbackUpdates) : config.updates;

  return createDesktopClient({
    ...config,
    session,
    storage: createTauriKeyValueStore(invoke, namespace, config.storageScope, config.initialStorageValues),
    secureStorage: createTauriSecureStorage(invoke, namespace),
    transport,
    desktop,
    files,
    updates
  });
}
