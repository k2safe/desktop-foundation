import {
  createDesktopClient,
  createGitHubReleasesUpdateConfig,
  createTauriDesktopClient,
  type AppUpdateConfig,
  type DesktopClient,
  type DesktopClientConfig
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
    return createTauriDesktopClient(invoke, clientConfig);
  }
  return createDesktopClient(clientConfig);
}
