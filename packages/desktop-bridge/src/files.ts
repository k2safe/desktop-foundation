import { DesktopError } from "./errors";
import type { DownloadFileOptions, DownloadFileResult, FileCapability, OpenFileDialogOptions, SaveFileDialogOptions } from "./types";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function inferFileName(url: string, fallback = "download.bin") {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.pathname.split("/").filter(Boolean).pop() || fallback;
  } catch {
    return fallback;
  }
}

export function createWebFileCapability(): FileCapability {
  return {
    async openFileDialog(options: OpenFileDialogOptions = {}) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = Boolean(options.multiple);
        const extensions = options.filters?.flatMap((filter) => filter.extensions ?? []) ?? [];
        if (extensions.length) {
          input.accept = extensions.map((extension) => (extension.startsWith(".") ? extension : `.${extension}`)).join(",");
        }
        input.onchange = () => {
          const paths = Array.from(input.files ?? []).map((file) => file.name);
          resolve({ paths, canceled: paths.length === 0 });
        };
        input.click();
      });
    },
    async saveFileDialog(options: SaveFileDialogOptions = {}) {
      const picker = (window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<{ name?: string }> }).showSaveFilePicker;
      if (!picker) {
        return { path: options.defaultFileName ?? null, canceled: false };
      }
      try {
        const handle = await picker({
          suggestedName: options.defaultFileName,
          types: options.filters?.map((filter) => ({
            description: filter.name,
            accept: { "*/*": filter.extensions?.map((extension) => (extension.startsWith(".") ? extension : `.${extension}`)) ?? [] }
          }))
        });
        return { path: handle.name ?? options.defaultFileName ?? null, canceled: false };
      } catch {
        return { path: null, canceled: true };
      }
    },
    async readTextFile() {
      throw new DesktopError({
        code: "WEB_FILE_PATH_UNAVAILABLE",
        message: "Browser runtime cannot read an arbitrary local path"
      });
    },
    async writeTextFile(path: string, content: string) {
      triggerDownload(new Blob([content], { type: "text/plain;charset=utf-8" }), path.split(/[\\/]/).pop() || "export.txt");
      return path;
    },
    async exportJson(fileName: string, data: unknown) {
      const content = JSON.stringify(data, null, 2);
      const finalName = fileName.endsWith(".json") ? fileName : `${fileName}.json`;
      triggerDownload(new Blob([content], { type: "application/json;charset=utf-8" }), finalName);
      return finalName;
    },
    async downloadFile(url: string, options: DownloadFileOptions = {}): Promise<DownloadFileResult> {
      const controller = options.timeoutMs ? new AbortController() : null;
      const timeout = controller ? window.setTimeout(() => controller.abort(), options.timeoutMs) : null;
      try {
        const response = await fetch(url, {
          headers: options.headers,
          signal: controller?.signal
        });
        const blob = await response.blob();
        const fileName = options.fileName ?? options.path?.split(/[\\/]/).pop() ?? inferFileName(url);
        triggerDownload(blob, fileName);
        return {
          path: fileName,
          bytes: blob.size,
          status: response.status,
          requestId: response.headers.get("x-request-id") ?? options.requestId
        };
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }
    }
  };
}
