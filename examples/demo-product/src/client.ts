import {
  createDesktopClient,
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
      return { paths: ["/tmp/foundation-demo.csv"], canceled: false };
    },
    async saveFileDialog() {
      pushLog("saveFileDialog");
      return { path: "/tmp/foundation-export.json", canceled: false };
    },
    async readTextFile(path) {
      pushLog(`readTextFile ${path}`);
      return "id,merchant,amount";
    },
    async writeTextFile(path) {
      pushLog(`writeTextFile ${path}`);
      return path;
    },
    async exportJson(fileName) {
      pushLog(`exportJson ${fileName}`);
      return `/tmp/${fileName}`;
    },
    async downloadFile(url) {
      pushLog(`downloadFile ${url}`);
      return { path: "/tmp/foundation-report.csv", bytes: 2048, status: 200 };
    }
  };
}

export function createDemoProductClient(pushLog: (value: string) => void): DesktopClient {
  return createDesktopClient({
    product: "demo-product",
    apiBaseURL: "https://api.foundation-demo.local",
    session: demoSessionStore(),
    storage: memoryStore({ "orders.density": "default" }),
    secureStorage: memorySecureStore(),
    transport: demoTransport(),
    desktop: demoDesktopCapability(pushLog),
    files: demoFileCapability(pushLog),
    security: {
      allowedRequestOrigins: ["api.foundation-demo.local"],
      allowedExternalOrigins: ["github.com", "docs.example.com"],
      allowedExternalSchemes: ["https"],
      allowedDownloadDirectories: ["/tmp"]
    }
  });
}

export async function loginDemoUser(client: DesktopClient, payload: { account: string; password: string; remember?: boolean }) {
  return client.http.post<{ token: string; user: DemoUser; remember?: boolean }>("/auth/login", payload, { auth: false });
}
