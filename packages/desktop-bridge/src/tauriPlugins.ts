import type {
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

export interface TauriNativePluginAdapters {
  openExternal?: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
  notify?: (options: NotifyOptions) => Promise<void>;
  openFileDialog?: (options?: OpenFileDialogOptions) => Promise<string | string[] | null>;
  saveFileDialog?: (options?: SaveFileDialogOptions) => Promise<string | null>;
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
