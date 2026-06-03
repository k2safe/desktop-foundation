# Tauri Updater Adapter

The foundation update UI talks to `client.updates`. Product projects can keep the default manifest downloader for check, download, and checksum verification, then enable the official Tauri updater plugin when native install/restart behavior is ready.

## Generated Template Toggle

Generated projects already contain a lightweight toggle in `src/api/client.ts`:

```bash
VITE_TAURI_UPDATER=1
```

When this flag is absent, the product uses the manifest flow only. When the flag is set inside Tauri, the client dynamically loads `@tauri-apps/plugin-updater` and wires it through `createTauriUpdaterPluginAdapters`.

## Client Wiring

```ts
import {
  createTauriDesktopClient,
  createTauriUpdaterPluginAdapters,
  type TauriUpdaterPluginModule
} from "@desktop-foundation/bridge";
import { invoke } from "@tauri-apps/api/core";

const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

async function createNativePlugins() {
  if (import.meta.env.VITE_TAURI_UPDATER !== "1") return undefined;
  const updater = await dynamicImport("@tauri-apps/plugin-updater") as TauriUpdaterPluginModule;
  return createTauriUpdaterPluginAdapters(updater);
}

export async function createProductClient() {
  return createTauriDesktopClient(invoke, {
    product: "product-desktop",
    apiBaseURL: import.meta.env.VITE_API_BASE_URL,
    version: import.meta.env.VITE_APP_VERSION,
    nativePlugins: await createNativePlugins(),
    updateConfig: {
      manifestUrl: import.meta.env.VITE_UPDATE_MANIFEST_URL,
      currentVersion: import.meta.env.VITE_APP_VERSION,
      channel: import.meta.env.VITE_UPDATE_CHANNEL ?? "stable",
      requireChecksumVerification: true
    }
  });
}
```

`createTauriUpdaterPluginAdapters` is structural: the bridge package does not depend on `@tauri-apps/plugin-updater`. Product repositories install and configure the Tauri plugin when they are ready for native install behavior.

## State Flow

The native adapter updates the same foundation state surface:

- `checking` while `updater.check()` runs.
- `available` or `not-available` after check.
- `downloading` and `downloaded` when the native update object exposes `download()`.
- `installing` and `installed` when `install()` or `downloadAndInstall()` completes.
- `error` with the adapter error message when the native updater fails.

Product UI still calls only:

```ts
await client.updates.checkForUpdate();
await client.updates.downloadUpdate();
await client.updates.installUpdate();
```

Do not implement direct `.app` replacement, `/Applications` file mutation, shell commands, or relaunch logic in business pages.

## Product Responsibilities

- Add and configure `@tauri-apps/plugin-updater` in the product repository.
- Register the Rust-side Tauri updater plugin and its permissions in the product `src-tauri` app.
- Keep signing, notarization, private release access, and updater endpoint policy in the product release pipeline.
- Keep manifest/checksum generation in the existing `desktop-foundation-ci --manifest --release-plan` path when using the foundation manifest downloader.
- Expose the install button only after native updater behavior is verified for the target platform.

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

This keeps update check, release notes, download state, checksum, and error UI available while the product team finishes native install behavior. In Tauri, manifest checks use the `desktop-core` HTTP transport that `createTauriDesktopClient` wires into the shared update capability.
