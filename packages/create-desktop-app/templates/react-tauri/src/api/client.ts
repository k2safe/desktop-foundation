import {
  createDesktopClient,
  createGitHubReleasesUpdateConfig,
  createTauriDesktopClient,
  type AppUpdateConfig,
  type DesktopClient,
  type DesktopClientConfig
} from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

const appVersion = import.meta.env.VITE_APP_VERSION || "0.1.0";

function envValue(name: string) {
  return (import.meta.env[name] as string | undefined)?.trim();
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
  product: "{{PRODUCT_ID}}",
  version: appVersion,
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || "{{API_BASE_URL}}",
  tokenKey: "{{PRODUCT_ID}}:desktop:token",
  updateConfig: createProductUpdateConfig(appVersion)
};

export async function createProductClient(): Promise<DesktopClient> {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, clientConfig);
  }
  return createDesktopClient(clientConfig);
}
