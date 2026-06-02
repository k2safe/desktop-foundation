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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function metadataString(update: AppUpdateManifest, key: string) {
  const value = update.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataNumber(update: AppUpdateManifest, key: string) {
  const value = update.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSha256(value?: string) {
  return value?.trim().toLowerCase();
}

function expectedSha256(update: AppUpdateManifest) {
  return normalizeSha256(update.sha256 ?? metadataString(update, "sha256"));
}

function expectedSize(update: AppUpdateManifest) {
  return update.size ?? metadataNumber(update, "size") ?? metadataNumber(update, "sizeBytes");
}

function normalizeManifest(payload: unknown): AppUpdateManifest | null {
  if (!isRecord(payload)) return null;
  const value = isRecord(payload.update) ? payload.update : payload;
  if (!isRecord(value) || typeof value.version !== "string") return null;

  const metadata = isRecord(value.metadata) ? value.metadata : undefined;
  const metadataSha256 = typeof metadata?.sha256 === "string" ? metadata.sha256 : undefined;
  const metadataSize = typeof metadata?.sizeBytes === "number" && Number.isFinite(metadata.sizeBytes)
    ? metadata.sizeBytes
    : typeof metadata?.size === "number" && Number.isFinite(metadata.size)
      ? metadata.size
      : undefined;

  return {
    version: value.version,
    channel: typeof value.channel === "string" ? value.channel : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
    pubDate: typeof value.pubDate === "string" ? value.pubDate : undefined,
    releasePageUrl: typeof value.releasePageUrl === "string" ? value.releasePageUrl : undefined,
    downloadUrl: typeof value.downloadUrl === "string" ? value.downloadUrl : undefined,
    sha256: typeof value.sha256 === "string" ? value.sha256 : metadataSha256,
    size: typeof value.size === "number" && Number.isFinite(value.size) ? value.size : metadataSize,
    mandatory: typeof value.mandatory === "boolean" ? value.mandatory : undefined,
    metadata
  };
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
    sha256: manifest.sha256,
    size: manifest.size,
    mandatory: manifest.mandatory,
    metadata: manifest.metadata
  };
}

function resolveUpdateUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined;
  return new URL(value, baseUrl).toString();
}

function resolveManifestUrls(manifest: AppUpdateManifest, baseUrl: string): AppUpdateManifest {
  return {
    ...manifest,
    releasePageUrl: resolveUpdateUrl(manifest.releasePageUrl, baseUrl),
    downloadUrl: resolveUpdateUrl(manifest.downloadUrl, baseUrl)
  };
}

function setError(state: AppUpdateState, error: unknown) {
  state.status = "error";
  state.error = error instanceof Error ? error.message : String(error);
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
    state.error = undefined;

    if (!manifestUrl) {
      state.status = "not-available";
      state.update = undefined;
      state.checkedAt = Date.now();
      return { available: false, currentVersion, checkedAt: state.checkedAt };
    }

    config.assertManifestUrl?.(manifestUrl);

    try {
      const url = new URL(manifestUrl, typeof window === "undefined" ? "http://localhost" : window.location.href);
      if (channel) url.searchParams.set("channel", channel);

      const response = await fetch(url.toString(), {
        headers: { ...config.headers, ...options.headers }
      });
      if (!response.ok) {
        throw new DesktopError({ code: "UPDATE_MANIFEST_FAILED", message: "Failed to load update manifest", status: response.status });
      }

      const manifest = normalizeManifest(await response.json());
      const manifestBaseUrl = response.url || url.toString();
      if (!manifest) {
        throw new DesktopError({ code: "UPDATE_MANIFEST_INVALID", message: "Update manifest is invalid" });
      }
      if (channel && manifest.channel && manifest.channel !== channel) {
        state.status = "not-available";
        state.update = undefined;
        state.checkedAt = Date.now();
        return { available: false, currentVersion, checkedAt: state.checkedAt };
      }

      const update = toUpdateInfo(resolveManifestUrls(manifest, manifestBaseUrl), currentVersion);
      const available = currentVersion ? compareVersions(update.version, currentVersion) > 0 : true;
      state.status = available ? "available" : "not-available";
      state.update = available ? update : undefined;
      state.checkedAt = Date.now();
      return { available, currentVersion, update: available ? update : undefined, checkedAt: state.checkedAt };
    } catch (error) {
      setError(state, error);
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
    state.error = undefined;

    try {
      const result = await files.downloadFile(update.downloadUrl, {
        ...options,
        auth: options.auth ?? false,
        fileName: options.fileName,
        requestId: options.requestId ?? "app-update-download",
        namespace: options.namespace ?? "app-update"
      });

      const size = expectedSize(update);
      if (typeof size === "number" && result.bytes !== size) {
        throw new DesktopError({
          code: "UPDATE_SIZE_MISMATCH",
          message: "Downloaded update size does not match the manifest",
          details: { expected: size, actual: result.bytes }
        });
      }

      const sha256 = expectedSha256(update);
      const actualSha256 = normalizeSha256(result.sha256);
      if (sha256 && actualSha256 && sha256 !== actualSha256) {
        throw new DesktopError({
          code: "UPDATE_CHECKSUM_MISMATCH",
          message: "Downloaded update checksum does not match the manifest",
          details: { expected: sha256, actual: actualSha256 }
        });
      }
      if (sha256 && !actualSha256 && config.requireChecksumVerification) {
        throw new DesktopError({
          code: "UPDATE_CHECKSUM_UNVERIFIED",
          message: "Downloaded update checksum could not be verified by the current file capability"
        });
      }

      state.status = "downloaded";
      state.downloadedPath = result.path;
      state.downloadedBytes = result.bytes;
      state.downloadedSha256 = actualSha256;
      return result;
    } catch (error) {
      setError(state, error);
      throw error;
    }
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
