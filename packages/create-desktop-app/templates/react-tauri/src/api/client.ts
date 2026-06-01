import { createDesktopClient, createTauriDesktopClient, type DesktopClient, type DesktopClientConfig } from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

export const clientConfig: DesktopClientConfig = {
  product: "{{PRODUCT_ID}}",
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || "{{API_BASE_URL}}",
  tokenKey: "{{PRODUCT_ID}}:desktop:token"
};

export async function createProductClient(): Promise<DesktopClient> {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriDesktopClient(invoke, clientConfig);
  }
  return createDesktopClient(clientConfig);
}
