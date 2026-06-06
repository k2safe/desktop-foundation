export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpResponseType = "json" | "text" | "base64";
export type HttpCacheStorage = "memory" | "persistent";

export interface HttpCacheOptions {
  key?: string;
  ttlMs: number;
  storage?: HttpCacheStorage;
  refresh?: boolean;
  staleIfError?: boolean;
}

export interface HttpCacheMetadata {
  hit: boolean;
  stale: boolean;
  key: string;
  storage: HttpCacheStorage;
  storedAt: number;
  expiresAt: number;
}

export interface HttpResponseMeta {
  status: number;
  headers?: Record<string, string>;
  requestId?: string;
  cache?: HttpCacheMetadata;
}

export interface HttpMultipartField {
  name: string;
  value: string;
}

export interface HttpMultipartFile {
  name: string;
  fileName: string;
  contentType?: string;
  bodyBase64: string;
}

export interface HttpMultipartForm {
  fields?: HttpMultipartField[];
  files?: HttpMultipartFile[];
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: QueryParams;
  body?: unknown;
  bodyBase64?: string;
  bodyContentType?: string;
  multipart?: HttpMultipartForm;
  responseType?: HttpResponseType;
  timeoutMs?: number;
  signal?: AbortSignal;
  auth?: boolean;
  requestId?: string;
  namespace?: string;
  cache?: HttpCacheOptions;
  onResponse?: (metadata: HttpResponseMeta) => void;
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
  targetPath?: string;
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

export type LinkProxyMode = "gateway" | "direct";

export interface LinkProxyConfig {
  mode?: LinkProxyMode;
  proxyBaseURL?: string;
  headers?: Record<string, string>;
  auth?: boolean;
}

export interface LinkProxyRequestOptions extends HttpRequestOptions {
  method?: HttpMethod;
  mode?: LinkProxyMode;
  proxyBaseURL?: string;
  proxyHeaders?: Record<string, string>;
}

export interface LinkProxyCapability {
  request<T>(url: string, options?: LinkProxyRequestOptions): Promise<T>;
  resolve(url: string): string;
  open(url: string, options?: { requestId?: string; namespace?: string }): Promise<void>;
}

export type ProxyMode = "none" | "system" | "http" | "socks5";

export interface ProxyConfig {
  enabled: boolean;
  mode: ProxyMode;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  bypass?: string[];
  hasPassword?: boolean;
}

export interface ProxyTestResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

export interface ProxyCapability {
  getConfig(): Promise<ProxyConfig>;
  setConfig(config: ProxyConfig): Promise<ProxyConfig>;
  clearConfig(): Promise<void>;
  testConnection(url?: string): Promise<ProxyTestResult>;
}

export interface AppUpdateConfig {
  currentVersion?: string;
  manifestUrl?: string;
  channel?: string;
  headers?: Record<string, string>;
  transport?: HttpTransport;
  assertManifestUrl?: (url: string) => void;
  requireChecksumVerification?: boolean;
  installUpdate?: AppUpdateInstallAdapter;
}

export interface GitHubReleasesUpdateConfig extends AppUpdateConfig {
  repository?: string;
  owner?: string;
  repo?: string;
  githubHost?: string;
  tag?: string;
  manifestFileName?: string;
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
  allowedLinkProxyOrigins?: string[];
  allowedLinkTargetOrigins?: string[];
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
  cache?: HttpCacheMetadata;
  ok?: boolean;
  error?: {
    name?: string;
    message: string;
    code?: string;
    status?: number;
    kind?: string;
    retryable?: boolean;
    requestId?: string;
  };
}

export type AuditEventLevel = "info" | "warn" | "error";

export interface AuditEventError {
  name?: string;
  message: string;
  code?: string;
  status?: number;
  kind?: string;
  retryable?: boolean;
  requestId?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  product?: string;
  namespace?: string;
  level: AuditEventLevel;
  action: string;
  ok?: boolean;
  message?: string;
  target?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: AuditEventError;
}

export type AuditEventInput = Omit<AuditEvent, "id" | "timestamp" | "level" | "product"> &
  Partial<Pick<AuditEvent, "id" | "timestamp" | "level" | "product">>;

export interface RequestObserver {
  onRequestStart?: (entry: RequestLogEntry) => void;
  onRequestEnd?: (entry: RequestLogEntry) => void;
  onUnauthorized?: (entry: RequestLogEntry) => void;
}

export interface AuditObserver {
  onAuditEvent?: (event: AuditEvent) => void;
}

export interface DesktopDiagnostics {
  getRecentRequests(): RequestLogEntry[];
  clearRecentRequests(): void;
  getRecentAuditEvents(): AuditEvent[];
  clearRecentAuditEvents(): void;
  recordAuditEvent(event: AuditEventInput): AuditEvent;
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
  proxy?: ProxyCapability;
  updateConfig?: AppUpdateConfig;
  linkProxy?: LinkProxyConfig;
  version?: string;
  requestObserver?: RequestObserver;
  auditObserver?: AuditObserver;
  onUnauthorized?: (entry: RequestLogEntry) => void;
  onAuditEvent?: (event: AuditEvent) => void;
  security?: DesktopSecurityPolicy;
  maxRequestLogEntries?: number;
  maxAuditEvents?: number;
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
  proxy: ProxyCapability;
  linkProxy: LinkProxyCapability;
  diagnostics: DesktopDiagnostics;
}
