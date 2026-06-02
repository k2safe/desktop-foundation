export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpResponseType = "json" | "text" | "base64";

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: QueryParams;
  body?: unknown;
  bodyBase64?: string;
  bodyContentType?: string;
  responseType?: HttpResponseType;
  timeoutMs?: number;
  signal?: AbortSignal;
  auth?: boolean;
  requestId?: string;
  namespace?: string;
}

export interface HttpTransportRequest extends HttpRequestOptions {
  method: HttpMethod;
  url: string;
  token?: string | null;
}

export interface HttpTransport {
  request<T>(request: HttpTransportRequest): Promise<T>;
}

export interface SessionStore {
  getToken(): string | null;
  setToken(token: string, remember?: boolean): void;
  clearToken(): void;
}

export interface KeyValueStore {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface AsyncKeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export type StorageScope = "app" | "user" | "secure";

export interface NotifyOptions {
  title: string;
  body?: string;
}

export interface DesktopCapability {
  openExternal(url: string): Promise<void>;
  copyText(text: string): Promise<void>;
  notify(options: NotifyOptions): Promise<void>;
  getWindowState(): Promise<WindowState | null>;
  setWindowState(state: Partial<WindowState>): Promise<void>;
  setWindowTitle(title: string): Promise<void>;
}

export interface DialogFilter {
  name: string;
  extensions?: string[];
}

export interface OpenFileDialogOptions {
  title?: string;
  directory?: string;
  filters?: DialogFilter[];
  multiple?: boolean;
}

export interface FileDialogResult {
  paths: string[];
  canceled: boolean;
}

export interface SaveFileDialogOptions {
  title?: string;
  directory?: string;
  defaultFileName?: string;
  filters?: DialogFilter[];
}

export interface SaveFileDialogResult {
  path?: string | null;
  canceled: boolean;
}

export interface DownloadFileOptions {
  path?: string;
  directory?: string;
  fileName?: string;
  headers?: Record<string, string>;
  query?: QueryParams;
  timeoutMs?: number;
  auth?: boolean;
  requestId?: string;
  namespace?: string;
}

export interface DownloadFileResult {
  path: string;
  bytes: number;
  sha256?: string;
  status?: number;
  requestId?: string;
}

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "installable"
  | "installing"
  | "installed"
  | "error";

export interface AppUpdateManifest {
  version: string;
  channel?: string;
  notes?: string;
  pubDate?: string;
  releasePageUrl?: string;
  downloadUrl?: string;
  sha256?: string;
  size?: number;
  mandatory?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AppUpdateInfo extends AppUpdateManifest {
  currentVersion?: string;
}

export interface AppUpdateState {
  status: AppUpdateStatus;
  checkedAt?: number;
  currentVersion?: string;
  update?: AppUpdateInfo;
  downloadedPath?: string;
  downloadedBytes?: number;
  downloadedSha256?: string;
  installMessage?: string;
  installedAt?: number;
  error?: string;
}

export interface AppUpdateCheckOptions {
  manifestUrl?: string;
  currentVersion?: string;
  channel?: string;
  headers?: Record<string, string>;
}

export interface AppUpdateCheckResult {
  available: boolean;
  currentVersion?: string;
  update?: AppUpdateInfo;
  checkedAt: number;
}

export type AppUpdateDownloadOptions = DownloadFileOptions;

export interface AppUpdateInstallContext {
  update: AppUpdateInfo;
  downloadedPath?: string;
  downloadedBytes?: number;
  downloadedSha256?: string;
}

export interface AppUpdateInstallResult {
  status?: Extract<AppUpdateStatus, "installable" | "installing" | "installed">;
  message?: string;
  path?: string;
  relaunchRequired?: boolean;
}

export type AppUpdateInstallAdapter = (context: AppUpdateInstallContext) => Promise<AppUpdateInstallResult | void>;

export interface AppUpdateCapability {
  checkForUpdate(options?: AppUpdateCheckOptions): Promise<AppUpdateCheckResult>;
  downloadUpdate(update?: AppUpdateInfo, options?: AppUpdateDownloadOptions): Promise<DownloadFileResult>;
  installUpdate(update?: AppUpdateInfo): Promise<AppUpdateInstallResult | void>;
  openUpdatePage(update?: AppUpdateInfo): Promise<void>;
  getState(): AppUpdateState;
}

export interface AppUpdateConfig {
  currentVersion?: string;
  manifestUrl?: string;
  channel?: string;
  headers?: Record<string, string>;
  assertManifestUrl?: (url: string) => void;
  requireChecksumVerification?: boolean;
  installUpdate?: AppUpdateInstallAdapter;
}

export interface FileCapability {
  openFileDialog(options?: OpenFileDialogOptions): Promise<FileDialogResult>;
  saveFileDialog(options?: SaveFileDialogOptions): Promise<SaveFileDialogResult>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string, options?: { createDir?: boolean }): Promise<string>;
  exportJson(fileName: string, data: unknown, options?: { directory?: string }): Promise<string>;
  downloadFile(url: string, options?: DownloadFileOptions): Promise<DownloadFileResult>;
}

export interface DesktopSecurityPolicy {
  allowedRequestOrigins?: string[];
  allowedExternalOrigins?: string[];
  allowedExternalSchemes?: string[];
  allowedDownloadDirectories?: string[];
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface RequestLogEntry {
  id: string;
  requestId?: string;
  method: HttpMethod;
  url: string;
  namespace?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  error?: {
    name?: string;
    message: string;
    code?: string;
    status?: number;
  };
}

export interface RequestObserver {
  onRequestStart?: (entry: RequestLogEntry) => void;
  onRequestEnd?: (entry: RequestLogEntry) => void;
  onUnauthorized?: (entry: RequestLogEntry) => void;
}

export interface DesktopDiagnostics {
  getRecentRequests(): RequestLogEntry[];
  clearRecentRequests(): void;
}

export interface DesktopClientConfig {
  product: string;
  apiBaseURL: string;
  tokenKey?: string;
  transport?: HttpTransport;
  session?: SessionStore;
  storage?: KeyValueStore;
  secureStorage?: AsyncKeyValueStore;
  desktop?: DesktopCapability;
  files?: FileCapability;
  updates?: AppUpdateCapability;
  updateConfig?: AppUpdateConfig;
  version?: string;
  requestObserver?: RequestObserver;
  onUnauthorized?: (entry: RequestLogEntry) => void;
  security?: DesktopSecurityPolicy;
  maxRequestLogEntries?: number;
  defaultHeaders?: Record<string, string>;
}

export interface DesktopClient {
  http: {
    get<T>(path: string, options?: HttpRequestOptions): Promise<T>;
    post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
    put<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
    patch<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
    delete<T>(path: string, options?: HttpRequestOptions): Promise<T>;
  };
  session: SessionStore;
  storage: KeyValueStore;
  secureStorage: AsyncKeyValueStore;
  desktop: DesktopCapability;
  files: FileCapability;
  updates: AppUpdateCapability;
  diagnostics: DesktopDiagnostics;
}
