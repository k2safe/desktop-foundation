import type {
  AppUpdateCapability,
  AppUpdateInfo,
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

export interface TauriNativeUpdate {
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall?: () => Promise<void>;
}

export interface TauriNativePluginAdapters {
  openExternal?: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
  notify?: (options: NotifyOptions) => Promise<void>;
  openFileDialog?: (options?: OpenFileDialogOptions) => Promise<string | string[] | null>;
  saveFileDialog?: (options?: SaveFileDialogOptions) => Promise<string | null>;
  checkUpdate?: () => Promise<TauriNativeUpdate | null>;
  installUpdate?: (update?: TauriNativeUpdate | null) => Promise<void>;
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
    currentVersion,
    notes: update.body,
    pubDate: update.date
  };
}

export function createTauriNativeUpdateCapability(adapters: TauriNativePluginAdapters, fallback: AppUpdateCapability): AppUpdateCapability {
  let nativeUpdate: TauriNativeUpdate | null = null;
  let lastUpdate: AppUpdateInfo | undefined;

  return {
    async checkForUpdate(options) {
      if (!adapters.checkUpdate) return fallback.checkForUpdate(options);
      nativeUpdate = await adapters.checkUpdate();
      lastUpdate = normalizeNativeUpdate(nativeUpdate, options?.currentVersion);
      return {
        available: Boolean(lastUpdate),
        currentVersion: options?.currentVersion,
        update: lastUpdate,
        checkedAt: Date.now()
      };
    },
    downloadUpdate: (update, options) => fallback.downloadUpdate(update ?? lastUpdate, options),
    async installUpdate(update) {
      if (adapters.installUpdate) {
        await adapters.installUpdate(nativeUpdate);
        return;
      }
      if (nativeUpdate?.downloadAndInstall) {
        await nativeUpdate.downloadAndInstall();
        return;
      }
      await fallback.installUpdate(update ?? lastUpdate);
    },
    openUpdatePage: (update) => fallback.openUpdatePage(update ?? lastUpdate),
    getState: () => ({
      ...fallback.getState(),
      status: lastUpdate ? "available" : fallback.getState().status,
      update: lastUpdate ?? fallback.getState().update
    })
  };
}
