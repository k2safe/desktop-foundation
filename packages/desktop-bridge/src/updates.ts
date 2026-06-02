import { DesktopError } from "./errors";
import type {
  AppUpdateCapability,
  AppUpdateCheckOptions,
  AppUpdateCheckResult,
  AppUpdateConfig,
  AppUpdateDownloadOptions,
  AppUpdateInfo,
  AppUpdateManifest,
  AppUpdateState,
  DesktopCapability,
  FileCapability
} from "./types";

function compareVersions(next: string, current: string) {
  const nextParts = next.split(/[.-]/).map((part) => Number(part));
  const currentParts = current.split(/[.-]/).map((part) => Number(part));
  const length = Math.max(nextParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = nextParts[index] ?? 0;
    const right = currentParts[index] ?? 0;
    if (Number.isNaN(left) || Number.isNaN(right)) return next.localeCompare(current);
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function normalizeManifest(payload: unknown): AppUpdateManifest | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { update?: unknown; version?: unknown };
  const value = candidate.update && typeof candidate.update === "object" ? candidate.update : payload;
  if (!value || typeof value !== "object") return null;
  const manifest = value as AppUpdateManifest;
  return typeof manifest.version === "string" ? manifest : null;
}

function createState(currentVersion?: string): AppUpdateState {
  return { status: "idle", currentVersion };
}

function toUpdateInfo(manifest: AppUpdateManifest, currentVersion?: string): AppUpdateInfo {
  return {
    version: manifest.version,
    currentVersion,
    channel: manifest.channel,
    notes: manifest.notes,
    pubDate: manifest.pubDate,
    releasePageUrl: manifest.releasePageUrl,
    downloadUrl: manifest.downloadUrl,
    mandatory: manifest.mandatory,
    metadata: manifest.metadata
  };
}

export function createNoopUpdateCapability(currentVersion?: string): AppUpdateCapability {
  const state = createState(currentVersion);
  return {
    async checkForUpdate() {
      state.status = "not-available";
      state.checkedAt = Date.now();
      return { available: false, currentVersion, checkedAt: state.checkedAt };
    },
    async downloadUpdate() {
      throw new DesktopError({ code: "UPDATE_DOWNLOAD_UNAVAILABLE", message: "Update download is not configured" });
    },
    async installUpdate() {
      throw new DesktopError({ code: "UPDATE_INSTALL_UNAVAILABLE", message: "Update install is not configured" });
    },
    async openUpdatePage() {
      throw new DesktopError({ code: "UPDATE_PAGE_UNAVAILABLE", message: "Update release page is not configured" });
    },
    getState: () => ({ ...state })
  };
}

export function createManifestUpdateCapability(
  config: AppUpdateConfig = {},
  desktop?: DesktopCapability,
  files?: FileCapability
): AppUpdateCapability {
  const state = createState(config.currentVersion);

  async function checkForUpdate(options: AppUpdateCheckOptions = {}): Promise<AppUpdateCheckResult> {
    const manifestUrl = options.manifestUrl ?? config.manifestUrl;
    const currentVersion = options.currentVersion ?? config.currentVersion;
    const channel = options.channel ?? config.channel;
    state.status = "checking";
    state.currentVersion = currentVersion;

    if (!manifestUrl) {
      state.status = "not-available";
      state.checkedAt = Date.now();
      return { available: false, currentVersion, checkedAt: state.checkedAt };
    }

    config.assertManifestUrl?.(manifestUrl);
    const url = new URL(manifestUrl, typeof window === "undefined" ? "http://localhost" : window.location.href);
    if (channel) url.searchParams.set("channel", channel);

    try {
      const response = await fetch(url.toString(), {
        headers: { ...config.headers, ...options.headers }
      });
      if (!response.ok) {
        throw new DesktopError({ code: "UPDATE_MANIFEST_FAILED", message: "Failed to load update manifest", status: response.status });
      }
      const manifest = normalizeManifest(await response.json());
      if (!manifest) {
        throw new DesktopError({ code: "UPDATE_MANIFEST_INVALID", message: "Update manifest is invalid" });
      }
      if (channel && manifest.channel && manifest.channel !== channel) {
        state.status = "not-available";
        state.checkedAt = Date.now();
        return { available: false, currentVersion, checkedAt: state.checkedAt };
      }

      const update = toUpdateInfo(manifest, currentVersion);
      const available = currentVersion ? compareVersions(update.version, currentVersion) > 0 : true;
      state.status = available ? "available" : "not-available";
      state.update = available ? update : undefined;
      state.checkedAt = Date.now();
      return { available, currentVersion, update: available ? update : undefined, checkedAt: state.checkedAt };
    } catch (error) {
      state.status = "error";
      state.error = error instanceof Error ? error.message : String(error);
      state.checkedAt = Date.now();
      throw error;
    }
  }

  async function downloadUpdate(update = state.update, options: AppUpdateDownloadOptions = {}) {
    if (!files) {
      throw new DesktopError({ code: "UPDATE_DOWNLOAD_UNAVAILABLE", message: "File capability is not configured" });
    }
    if (!update?.downloadUrl) {
      throw new DesktopError({ code: "UPDATE_DOWNLOAD_URL_MISSING", message: "Update download URL is missing" });
    }
    state.status = "downloading";
    const result = await files.downloadFile(update.downloadUrl, {
      ...options,
      fileName: options.fileName,
      requestId: options.requestId ?? "app-update-download",
      namespace: options.namespace ?? "app-update"
    });
    state.status = "downloaded";
    state.downloadedPath = result.path;
    return result;
  }

  async function openUpdatePage(update = state.update) {
    const url = update?.releasePageUrl ?? update?.downloadUrl;
    if (!desktop || !url) {
      throw new DesktopError({ code: "UPDATE_PAGE_UNAVAILABLE", message: "Update release page is not configured" });
    }
    await desktop.openExternal(url);
  }

  return {
    checkForUpdate,
    downloadUpdate,
    async installUpdate() {
      throw new DesktopError({ code: "UPDATE_INSTALL_UNAVAILABLE", message: "Update install is not configured" });
    },
    openUpdatePage,
    getState: () => ({ ...state })
  };
}
