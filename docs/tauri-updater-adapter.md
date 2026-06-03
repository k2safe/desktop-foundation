# Tauri Updater Adapter

The foundation update UI talks to `client.updates`. Product projects can keep the default manifest downloader, or bridge to the official Tauri updater plugin through `nativePlugins`.

## Client Wiring

```ts
import { createTauriDesktopClient, type TauriNativePluginAdapters } from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

async function createTauriUpdaterAdapters(): Promise<TauriNativePluginAdapters> {
  const updater = await import("@tauri-apps/plugin-updater");

  return {
    async checkUpdate() {
      const update = await updater.check();
      if (!update) return null;
      return {
        version: update.version,
        date: update.date,
        body: update.body,
        downloadAndInstall: () => update.downloadAndInstall()
      };
    },
    async installUpdate(update) {
      await update?.downloadAndInstall?.();
    }
  };
}

export async function createProductClient() {
  const nativePlugins = "__TAURI_INTERNALS__" in window ? await createTauriUpdaterAdapters() : undefined;

  return createTauriDesktopClient(invoke, {
    product: "product-desktop",
    apiBaseURL: import.meta.env.VITE_API_BASE_URL,
    version: import.meta.env.VITE_APP_VERSION,
    nativePlugins,
    updateConfig: {
      currentVersion: import.meta.env.VITE_APP_VERSION,
      channel: import.meta.env.VITE_UPDATE_CHANNEL ?? "stable"
    }
  });
}
```

When `nativePlugins.checkUpdate` or `nativePlugins.installUpdate` is present, `createTauriDesktopClient` routes `client.updates.checkForUpdate` and `client.updates.installUpdate` through the native adapter. Product UI still calls the same foundation update surface.

## Product Responsibilities

- Add and configure `@tauri-apps/plugin-updater` in the product repository.
- Keep signing, notarization, private release access, and updater endpoint policy in the product release pipeline.
- Keep manifest/checksum generation in the existing `desktop-foundation-ci --manifest --release-plan` path when using the foundation manifest downloader.
- Use native updater install only when the product has verified its platform-specific updater setup.

## Lightweight Manifest Fallback

Products can start without native install support:

```ts
createTauriDesktopClient(invoke, {
  product: "product-desktop",
  apiBaseURL: import.meta.env.VITE_API_BASE_URL,
  version: import.meta.env.VITE_APP_VERSION,
  updateConfig: {
    manifestUrl: import.meta.env.VITE_UPDATE_MANIFEST_URL,
    currentVersion: import.meta.env.VITE_APP_VERSION,
    requireChecksumVerification: true
  }
});
```

This keeps update check, release notes, download state, checksum, and error UI available while the product team finishes native install behavior.
