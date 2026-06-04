import {
  createDesktopClient,
  createGitHubReleasesUpdateConfig,
  createTauriDesktopClient,
  createTauriUpdaterPluginAdapters,
  type AppUpdateConfig,
  type DesktopClient,
  type DesktopClientConfig,
  type TauriNativePluginAdapters,
  type TauriUpdaterPluginModule
} from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";
import { productAdapter } from "../product-adapter";

const appVersion = import.meta.env.VITE_APP_VERSION || "0.1.0";

function envValue(name: string) {
  return (import.meta.env[name] as string | undefined)?.trim();
}

function envList(name: string) {
  const value = envValue(name);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
}

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

async function createProductNativePlugins(): Promise<TauriNativePluginAdapters | undefined> {
  if (envValue("VITE_TAURI_UPDATER") !== "1") return undefined;

  try {
    const updater = await dynamicImport("@tauri-apps/plugin-updater") as TauriUpdaterPluginModule;
    return createTauriUpdaterPluginAdapters(updater);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error("Tauri updater is enabled but @tauri-apps/plugin-updater could not be loaded: " + message);
  }
}

function createProductUpdateConfig(currentVersion: string): AppUpdateConfig {
  const manifestUrl = envValue("VITE_UPDATE_MANIFEST_URL");
  const githubRepository = envValue("VITE_UPDATE_GITHUB_REPO");
  const channel = envValue("VITE_UPDATE_CHANNEL") || "stable";

  if (manifestUrl) {
    return {
      currentVersion,
      manifestUrl,
      channel,
      requireChecksumVerification: envValue("VITE_UPDATE_REQUIRE_CHECKSUM") === "1"
    };
  }

  if (githubRepository) {
    return createGitHubReleasesUpdateConfig({
      currentVersion,
      repository: githubRepository,
      githubHost: envValue("VITE_UPDATE_GITHUB_HOST"),
      tag: envValue("VITE_UPDATE_TAG"),
      manifestFileName: envValue("VITE_UPDATE_MANIFEST_FILE") || "latest.json",
      channel,
      requireChecksumVerification: envValue("VITE_UPDATE_REQUIRE_CHECKSUM") === "1"
    });
  }

  return { currentVersion, channel };
}

export const clientConfig: DesktopClientConfig = {
  product: productAdapter.clientDefaults.product,
  version: appVersion,
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || productAdapter.clientDefaults.apiBaseURL,
  tokenKey: productAdapter.clientDefaults.tokenKey,
  onAuditEvent: (event) => {
    if (import.meta.env.DEV) {
      console.debug("[foundation:audit]", event.action, event);
    }
  },
  updateConfig: createProductUpdateConfig(appVersion),
  linkProxy: envValue("VITE_LINK_PROXY_URL")
    ? {
        mode: "gateway",
        proxyBaseURL: envValue("VITE_LINK_PROXY_URL"),
        auth: envValue("VITE_LINK_PROXY_AUTH") === "1"
      }
    : undefined,
  security: {
    allowedLinkProxyOrigins: envList("VITE_LINK_PROXY_ORIGINS"),
    allowedLinkTargetOrigins: envList("VITE_LINK_TARGET_ORIGINS")
  }
};

export async function createProductClient(): Promise<DesktopClient> {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, {
      ...clientConfig,
      nativePlugins: await createProductNativePlugins()
    });
  }
  return createDesktopClient(clientConfig);
}
