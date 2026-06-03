import type {
  AppUpdateCapability,
  AppUpdateCheckOptions,
  AppUpdateDownloadOptions,
  AppUpdateInstallContext,
  AppUpdateInstallResult,
  AppUpdateInfo,
  AppUpdateState,
  DesktopCapability,
  DownloadFileOptions,
  DownloadFileResult,
  FileCapability,
  FileDialogResult,
  NotifyOptions,
  OpenFileDialogOptions,
  SaveFileDialogOptions,
  SaveFileDialogResult
} from "./types";

export interface TauriUpdaterProgressEvent {
  event?: string;
  data?: {
    contentLength?: number;
    chunkLength?: number;
  };
}

export type TauriUpdaterProgressHandler = (event: TauriUpdaterProgressEvent) => void;

export interface TauriNativeUpdate {
  version: string;
  currentVersion?: string;
  date?: string;
  body?: string;
  releasePageUrl?: string;
  downloadUrl?: string;
  metadata?: Record<string, unknown>;
  download?: (onEvent?: TauriUpdaterProgressHandler) => Promise<void>;
  install?: () => Promise<void>;
  downloadAndInstall?: (onEvent?: TauriUpdaterProgressHandler) => Promise<void>;
}

export interface TauriNativePluginAdapters {
  openExternal?: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
  notify?: (options: NotifyOptions) => Promise<void>;
  openFileDialog?: (options?: OpenFileDialogOptions) => Promise<string | string[] | null>;
  saveFileDialog?: (options?: SaveFileDialogOptions) => Promise<string | null>;
  checkUpdate?: (options?: AppUpdateCheckOptions) => Promise<TauriNativeUpdate | null>;
  downloadUpdate?: (
    update?: TauriNativeUpdate | null,
    options?: AppUpdateDownloadOptions,
    onEvent?: TauriUpdaterProgressHandler
  ) => Promise<DownloadFileResult | void>;
  installUpdate?: (update?: TauriNativeUpdate | null, context?: AppUpdateInstallContext) => Promise<AppUpdateInstallResult | void>;
}

export interface TauriUpdaterPluginUpdate {
  version: string;
  currentVersion?: string;
  date?: string;
  body?: string;
  download?: (onEvent?: TauriUpdaterProgressHandler) => Promise<void>;
  install?: () => Promise<void>;
  downloadAndInstall?: (onEvent?: TauriUpdaterProgressHandler) => Promise<void>;
}

export interface TauriUpdaterPluginModule {
  check(options?: unknown): Promise<TauriUpdaterPluginUpdate | null>;
}

export interface TauriUpdaterPluginAdapterOptions {
  checkOptions?: unknown;
  mapUpdate?: (update: TauriUpdaterPluginUpdate) => TauriNativeUpdate;
  onEvent?: TauriUpdaterProgressHandler;
}

function normalizeOpenResult(value: string | string[] | null): FileDialogResult {
  if (Array.isArray(value)) return { paths: value, canceled: value.length === 0 };
  if (value) return { paths: [value], canceled: false };
  return { paths: [], canceled: true };
}

function normalizeSaveResult(value: string | null): SaveFileDialogResult {
  return { path: value, canceled: !value };
}

export function createTauriNativeDesktopCapability(adapters: TauriNativePluginAdapters, fallback: DesktopCapability): DesktopCapability {
  return {
    openExternal: adapters.openExternal ?? fallback.openExternal,
    copyText: adapters.copyText ?? fallback.copyText,
    notify: adapters.notify ?? fallback.notify,
    getWindowState: fallback.getWindowState,
    setWindowState: fallback.setWindowState,
    setWindowTitle: fallback.setWindowTitle
  };
}

export function createTauriNativeFileCapability(adapters: TauriNativePluginAdapters, fallback: FileCapability): FileCapability {
  return {
    openFileDialog: adapters.openFileDialog ? async (options) => normalizeOpenResult(await adapters.openFileDialog?.(options) ?? null) : fallback.openFileDialog,
    saveFileDialog: adapters.saveFileDialog ? async (options) => normalizeSaveResult(await adapters.saveFileDialog?.(options) ?? null) : fallback.saveFileDialog,
    readTextFile: fallback.readTextFile,
    writeTextFile: fallback.writeTextFile,
    exportJson: fallback.exportJson,
    downloadFile: (url: string, options?: DownloadFileOptions): Promise<DownloadFileResult> => fallback.downloadFile(url, options)
  };
}

function normalizeNativeUpdate(update: TauriNativeUpdate | null, currentVersion?: string): AppUpdateInfo | undefined {
  if (!update) return undefined;
  return {
    version: update.version,
    currentVersion: currentVersion ?? update.currentVersion,
    notes: update.body,
    pubDate: update.date,
    releasePageUrl: update.releasePageUrl,
    downloadUrl: update.downloadUrl,
    metadata: { native: true, ...update.metadata }
  };
}

function createUpdatePackageResult(update: AppUpdateInfo | undefined, options: AppUpdateDownloadOptions = {}, bytes = 0): DownloadFileResult {
  return {
    path: options.path ?? options.fileName ?? (update ? `tauri-updater://${update.version}` : "tauri-updater://update"),
    bytes,
    requestId: options.requestId
  };
}

function stateWithError(state: AppUpdateState, error: unknown): AppUpdateState {
  return {
    ...state,
    status: "error",
    error: error instanceof Error ? error.message : String(error)
  };
}

function applyProgress(state: AppUpdateState, event: TauriUpdaterProgressEvent) {
  const data = event.data;
  if (!data) return;
  if (typeof data.contentLength === "number" && state.downloadedBytes === undefined) {
    state.downloadedBytes = 0;
  }
  if (typeof data.chunkLength === "number") {
    state.downloadedBytes = (state.downloadedBytes ?? 0) + data.chunkLength;
  }
}

export function createTauriUpdaterPluginAdapters(
  updater: TauriUpdaterPluginModule,
  options: TauriUpdaterPluginAdapterOptions = {}
): TauriNativePluginAdapters {
  let currentUpdate: TauriUpdaterPluginUpdate | null = null;

  return {
    async checkUpdate() {
      currentUpdate = await updater.check(options.checkOptions);
      if (!currentUpdate) return null;
      return options.mapUpdate ? options.mapUpdate(currentUpdate) : currentUpdate;
    },
    async downloadUpdate(_update, _downloadOptions, onEvent) {
      if (!currentUpdate?.download) return;
      await currentUpdate.download((event) => {
        options.onEvent?.(event);
        onEvent?.(event);
      });
    },
    async installUpdate(update) {
      const candidate = currentUpdate ?? update;
      if (candidate?.install) {
        await candidate.install();
        return { status: "installed", message: "Update installed. Restart the app.", relaunchRequired: true };
      }
      if (candidate?.downloadAndInstall) {
        await candidate.downloadAndInstall(options.onEvent);
        return { status: "installed", message: "Update downloaded and installed. Restart the app.", relaunchRequired: true };
      }
      return { status: "installable", message: "Tauri updater returned an update without install support.", relaunchRequired: true };
    }
  };
}

export function createTauriNativeUpdateCapability(adapters: TauriNativePluginAdapters, fallback: AppUpdateCapability): AppUpdateCapability {
  let nativeUpdate: TauriNativeUpdate | null = null;
  let lastUpdate: AppUpdateInfo | undefined;
  let state: AppUpdateState = fallback.getState();

  function syncFromFallback() {
    state = fallback.getState();
    return state;
  }

  function setState(next: Partial<AppUpdateState>) {
    state = { ...state, ...next };
  }

  function progressHandler(event: TauriUpdaterProgressEvent) {
    applyProgress(state, event);
  }

  return {
    async checkForUpdate(options) {
      if (!adapters.checkUpdate) {
        const result = await fallback.checkForUpdate(options);
        syncFromFallback();
        return result;
      }

      setState({
        status: "checking",
        currentVersion: options?.currentVersion ?? state.currentVersion,
        error: undefined,
        update: undefined,
        downloadedPath: undefined,
        downloadedBytes: undefined,
        downloadedSha256: undefined,
        installMessage: undefined,
        installedAt: undefined
      });

      try {
        nativeUpdate = await adapters.checkUpdate(options);
        lastUpdate = normalizeNativeUpdate(nativeUpdate, options?.currentVersion ?? state.currentVersion);
        setState({
          status: lastUpdate ? "available" : "not-available",
          checkedAt: Date.now(),
          update: lastUpdate
        });
        return {
          available: Boolean(lastUpdate),
          currentVersion: state.currentVersion,
          update: lastUpdate,
          checkedAt: state.checkedAt ?? Date.now()
        };
      } catch (error) {
        state = stateWithError(state, error);
        throw error;
      }
    },
    async downloadUpdate(update = lastUpdate, options) {
      if (!nativeUpdate && !adapters.downloadUpdate) {
        const result = await fallback.downloadUpdate(update, options);
        syncFromFallback();
        return result;
      }

      const hasNativeDownload = Boolean(adapters.downloadUpdate || nativeUpdate?.download);
      if (!hasNativeDownload) {
        const result = await fallback.downloadUpdate(update ?? lastUpdate, options);
        syncFromFallback();
        return result;
      }

      setState({ status: "downloading", update: update ?? lastUpdate, error: undefined, installMessage: undefined });
      try {
        let adapterResult = await adapters.downloadUpdate?.(nativeUpdate, options, progressHandler);
        if (!adapterResult && nativeUpdate?.download) {
          await nativeUpdate.download(progressHandler);
        }
        const result = adapterResult ?? createUpdatePackageResult(update ?? lastUpdate, options, state.downloadedBytes ?? 0);
        setState({
          status: "downloaded",
          downloadedPath: result.path,
          downloadedBytes: result.bytes,
          downloadedSha256: result.sha256,
          installMessage: "Update package is ready for the native updater."
        });
        return result;
      } catch (error) {
        state = stateWithError(state, error);
        throw error;
      }
    },
    async installUpdate(update = lastUpdate) {
      if (!nativeUpdate && !adapters.installUpdate) {
        const result = await fallback.installUpdate(update);
        syncFromFallback();
        return result;
      }

      const context: AppUpdateInstallContext = {
        update: update ?? lastUpdate ?? normalizeNativeUpdate(nativeUpdate) ?? { version: "unknown" },
        downloadedPath: state.downloadedPath,
        downloadedBytes: state.downloadedBytes,
        downloadedSha256: state.downloadedSha256
      };

      setState({ status: "installing", error: undefined, installMessage: undefined });
      try {
        let result = await adapters.installUpdate?.(nativeUpdate, context);
        if (!result && nativeUpdate?.install) {
          await nativeUpdate.install();
          result = { status: "installed", message: "Update installed. Restart the app.", relaunchRequired: true };
        }
        if (!result && nativeUpdate?.downloadAndInstall) {
          await nativeUpdate.downloadAndInstall(progressHandler);
          result = { status: "installed", message: "Update downloaded and installed. Restart the app.", relaunchRequired: true };
        }
        if (!result) {
          result = await fallback.installUpdate(update ?? lastUpdate);
          syncFromFallback();
          return result;
        }
        setState({
          status: result.status ?? "installed",
          installMessage: result.message,
          installedAt: (result.status ?? "installed") === "installed" ? Date.now() : state.installedAt
        });
        return result;
      } catch (error) {
        state = stateWithError(state, error);
        throw error;
      }
    },
    async openUpdatePage(update = lastUpdate) {
      await fallback.openUpdatePage(update ?? lastUpdate);
      syncFromFallback();
    },
    getState: () => ({ ...state, update: state.update ?? lastUpdate ?? fallback.getState().update })
  };
}
