import { createDesktopClient, createTauriDesktopClient, type DesktopClient, type DesktopClientConfig } from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

export const clientConfig: DesktopClientConfig = {
  product: "{{PRODUCT_ID}}",
  version: "0.1.0",
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || "{{API_BASE_URL}}",
  tokenKey: "{{PRODUCT_ID}}:desktop:token",
  updateConfig: {
    manifestUrl: import.meta.env.VITE_UPDATE_MANIFEST_URL || undefined,
    channel: import.meta.env.VITE_UPDATE_CHANNEL || "stable"
  }
};

export async function createProductClient(): Promise<DesktopClient> {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, clientConfig);
  }
  return createDesktopClient(clientConfig);
}
