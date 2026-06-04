import {
  createDesktopClient,
  type AppUpdateConfig,
  type AsyncKeyValueStore,
  type DesktopCapability,
  type DesktopClient,
  type FileCapability,
  type HttpTransport,
  type HttpTransportRequest,
  type KeyValueStore,
  type SessionStore
} from "@desktop-foundation/bridge";
import { demoUser, orders, type DemoUser } from "./data";

const demoVersion = "0.1.0";
const demoUpdateManifestUrl = "/update/latest.json";

async function hashArrayBufferSha256(buffer: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function inferDownloadFileName(url: string) {
  return new URL(url, globalThis.location?.href ?? "http://localhost").pathname.split("/").filter(Boolean).pop() || "download.bin";
}

function memoryStore(initialValues: Record<string, unknown> = {}): KeyValueStore {
  const values = new Map<string, unknown>(Object.entries(initialValues));
  return {
    get: <T,>(key: string) => (values.has(key) ? (values.get(key) as T) : null),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    }
  };
}

function memorySecureStore(): AsyncKeyValueStore {
  const values = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return values.has(key) ? (values.get(key) as T) : null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    }
  };
}

function demoSessionStore(): SessionStore {
  let token: string | null = null;
  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = null;
    }
  };
}

function demoTransport(): HttpTransport {
  return {
    async request<T>(request: HttpTransportRequest) {
      if (request.url.endsWith("/auth/login")) {
        const payload = request.body as { account?: string; password?: string; remember?: boolean };
        if (!payload.account || !payload.password) throw new Error("Account and password are required");
        return { token: "demo-token", remember: payload.remember, user: demoUser } as T;
      }
      if (request.url.endsWith("/me")) {
        return demoUser as T;
      }
      if (request.url.endsWith("/orders")) {
        return { rows: orders, total: orders.length } as T;
      }
      if (request.url.includes("/link-proxy")) {
        const payload = request.body as { url?: string; method?: string; query?: unknown };
        return { ok: true, via: "local-vpn-proxy", target: payload.url, method: payload.method, query: payload.query, requestId: request.requestId } as T;
      }
      return { ok: true, method: request.method, url: request.url, requestId: request.requestId } as T;
    }
  };
}

function demoDesktopCapability(pushLog: (value: string) => void): DesktopCapability {
  return {
    async openExternal(url) {
      pushLog(`openExternal ${url}`);
    },
    async copyText(text) {
      pushLog(`copyText ${text}`);
    },
    async notify(options) {
      pushLog(`notify ${options.title}`);
    },
    async getWindowState() {
      return { x: 80, y: 80, width: 1280, height: 820, maximized: false, fullscreen: false };
    },
    async setWindowState(state) {
      pushLog(`setWindowState ${JSON.stringify(state)}`);
    },
    async setWindowTitle(title) {
      pushLog(`setWindowTitle ${title}`);
    }
  };
}

function demoFileCapability(pushLog: (value: string) => void): FileCapability {
  return {
    async openFileDialog() {
      pushLog("openFileDialog");
      return { paths: ["/tmp/product-records.csv"], canceled: false };
    },
    async saveFileDialog() {
      pushLog("saveFileDialog");
      return { path: "/tmp/product-export.json", canceled: false };
    },
    async readTextFile(path) {
      pushLog(`readTextFile ${path}`);
      return "id,customer,amount";
    },
    async writeTextFile(path) {
      pushLog(`writeTextFile ${path}`);
      return path;
    },
    async exportJson(fileName) {
      pushLog(`exportJson ${fileName}`);
      return `/tmp/${fileName}`;
    },
    async downloadFile(url, options = {}) {
      pushLog(`downloadFile ${url}`);
      if (options.namespace === "app-update" || url.includes("/update/")) {
        const response = await fetch(url, { headers: options.headers });
        const buffer = await response.arrayBuffer();
        return {
          path: options.fileName ?? inferDownloadFileName(url),
          bytes: buffer.byteLength,
          sha256: await hashArrayBufferSha256(buffer),
          status: response.status,
          requestId: options.requestId
        };
      }
      return { path: "/tmp/product-report.csv", bytes: 2048, status: 200, requestId: options.requestId };
    }
  };
}

function demoUpdateConfig(): AppUpdateConfig {
  return {
    manifestUrl: demoUpdateManifestUrl,
    currentVersion: demoVersion,
    channel: "stable",
    requireChecksumVerification: true
  };
}

export function createDemoProductClient(pushLog: (value: string) => void): DesktopClient {
  return createDesktopClient({
    product: "product-demo",
    version: demoVersion,
    apiBaseURL: "https://api.product-demo.local",
    session: demoSessionStore(),
    storage: memoryStore({ "orders.density": "default" }),
    secureStorage: memorySecureStore(),
    transport: demoTransport(),
    desktop: demoDesktopCapability(pushLog),
    files: demoFileCapability(pushLog),
    updateConfig: demoUpdateConfig(),
    onAuditEvent: (event) => {
      pushLog(`audit ${event.level} ${event.action}${event.message ? ` ${event.message}` : ""}`);
    },
    linkProxy: {
      mode: "gateway",
      proxyBaseURL: "http://127.0.0.1:17890/link-proxy",
      headers: { "x-demo-proxy": "local-vpn" }
    },
    security: {
      allowedRequestOrigins: ["localhost", "127.0.0.1", "::1", "[::1]", "api.product-demo.local", "github.com", "raw.githubusercontent.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com"],
      allowedLinkProxyOrigins: ["localhost", "127.0.0.1", "::1", "[::1]", "*.corp.local"],
      allowedExternalOrigins: ["github.com", "docs.example.com"],
      allowedExternalSchemes: ["https"],
      allowedDownloadDirectories: ["/tmp"]
    }
  });
}

export async function loginDemoUser(client: DesktopClient, payload: { account: string; password: string; remember?: boolean }) {
  return client.http.post<{ token: string; user: DemoUser; remember?: boolean }>("/auth/login", payload, { auth: false });
}
