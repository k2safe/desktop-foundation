#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifestPath = resolve(repoRoot, "artifacts/npm/foundation-packages.json");

function parseArgs(argv) {
  const options = {
    keep: false,
    manifestPath: defaultManifestPath,
    dir: null,
    localArtifacts: false,
    proxy: process.env.PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "",
    reportPath: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--manifest") {
      const nextManifest = argv[index + 1] || "";
      options.manifestPath = /^https?:\/\//.test(nextManifest) ? nextManifest : resolve(nextManifest);
      index += 1;
    } else if (arg === "--dir") {
      options.dir = resolve(argv[index + 1] || "");
      options.keep = true;
      index += 1;
    } else if (arg === "--local-artifacts") {
      options.localArtifacts = true;
    } else if (arg === "--proxy") {
      options.proxy = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--report") {
      options.reportPath = resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "smoke-external-ai-demo [--manifest URL_OR_PATH] [--local-artifacts] [--keep] [--dir PATH] [--proxy URL] [--report PATH]"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function createReport(options) {
  return {
    ok: false,
    manifest: options.manifestPath,
    workspace: null,
    foundationVersion: null,
    capabilities: {
      count: 0,
      required: [],
      missing: []
    },
    steps: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null
  };
}

async function writeReport(reportPath, report) {
  if (!reportPath) return;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function markStep(report, name, status, details = {}) {
  report.steps.push({
    name,
    status,
    at: new Date().toISOString(),
    ...details
  });
}

async function runReported(report, name, action) {
  const startedAt = Date.now();
  try {
    const result = await action();
    markStep(report, name, "ok", { durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    markStep(report, name, "failed", {
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function scanValue(value, predicate) {
  if (Array.isArray(value)) return value.some((item) => scanValue(item, predicate));
  if (value && typeof value === "object") return Object.values(value).some((item) => scanValue(item, predicate));
  return typeof value === "string" && predicate(value);
}

function assertNoWorkspaceReferences(packageJson) {
  const hasWorkspaceReference = scanValue(packageJson, (value) => {
    return value.includes("workspace:") || value.startsWith("link:") || value.startsWith("file:");
  });
  if (hasWorkspaceReference) {
    throw new Error("External smoke package.json contains workspace/link/file dependencies.");
  }
}

async function assertFileDoesNotContain(filePath, forbiddenValues) {
  if (!existsSync(filePath)) return;
  const content = await readFile(filePath, "utf8");
  const hit = forbiddenValues.find((value) => content.includes(value));
  if (hit) {
    throw new Error(`${filePath} contains forbidden local/workspace reference: ${hit}`);
  }
}

function shouldBypassProxy(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

function proxyEnv(options) {
  const env = { ...process.env };
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) {
    delete env[key];
  }
  if (options.proxy) {
    env.HTTPS_PROXY = options.proxy;
    env.HTTP_PROXY = options.proxy;
    env.https_proxy = options.proxy;
    env.http_proxy = options.proxy;
  }
  const noProxyValues = unique([env.NO_PROXY, env.no_proxy, "127.0.0.1", "localhost", "::1"]);
  env.NO_PROXY = noProxyValues.join(",");
  env.no_proxy = env.NO_PROXY;
  return env;
}

async function run(command, args, cwd, options = {}) {
  console.log(`\nexternal-ai-demo $ ${command} ${args.join(" ")}`);
  const env = proxyEnv(options);
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} ${args.join(" ")} failed with ${signal || `exit code ${code}`}`));
      }
    });
  });
}

function readUrl(url, options) {
  const args = ["-fsSL", "--retry", "3", "--retry-connrefused", "--retry-delay", "2", "--max-time", "90"];
  if (options.proxy && !shouldBypassProxy(url)) args.push("--proxy", options.proxy);
  args.push(url);

  const result = spawnSync("curl", args, { encoding: "utf8", cwd: repoRoot, env: proxyEnv(options), shell: false });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to fetch URL: ${url}`);
  }
  return result.stdout;
}

async function writeText(baseDir, relativePath, content) {
  const target = resolve(baseDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content.trimStart(), "utf8");
}

async function readManifest(manifestPath, options) {
  const source = /^https?:\/\//.test(manifestPath)
    ? readUrl(manifestPath, options)
    : await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(source);
  const consumer = manifest.consumer || {};
  if (!consumer.dependencies || !consumer.devDependencies || !consumer.pnpm) {
    throw new Error(`Manifest is missing consumer dependencies/devDependencies/pnpm: ${manifestPath}`);
  }
  return manifest;
}

async function readCapabilityRegistry(manifest, options) {
  const capabilityUrl = manifest.capabilities?.url;
  if (!capabilityUrl) {
    throw new Error("Manifest is missing capabilities.url");
  }

  const source = /^https?:\/\//.test(capabilityUrl)
    ? readUrl(capabilityUrl, options)
    : await readFile(resolve(repoRoot, capabilityUrl), "utf8");
  const registry = JSON.parse(source);
  if (!Array.isArray(registry.capabilities) || registry.capabilities.length === 0) {
    throw new Error("Capability registry has no capabilities");
  }
  return registry;
}

function rewriteManifestUrls(manifest, baseUrl) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  nextManifest.baseUrl = baseUrl;

  const packageUrls = new Map();
  for (const item of nextManifest.packages || []) {
    item.url = `${baseUrl}/${item.file}`;
    packageUrls.set(item.name, item.url);
  }
  if (nextManifest.capabilities?.file) {
    nextManifest.capabilities.url = `${baseUrl}/${nextManifest.capabilities.file}`;
  }

  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(nextManifest.consumer?.[section] || {})) {
      const nextUrl = packageUrls.get(name);
      if (nextUrl) nextManifest.consumer[section][name] = nextUrl;
    }
  }

  for (const name of Object.keys(nextManifest.consumer?.pnpm?.overrides || {})) {
    const nextUrl = packageUrls.get(name);
    if (nextUrl) nextManifest.consumer.pnpm.overrides[name] = nextUrl;
  }

  return nextManifest;
}

async function startArtifactServer(artifactDir) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const fileName = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ""));
      if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
        response.writeHead(404);
        response.end("not found");
        return;
      }

      const body = await readFile(join(artifactDir, fileName));
      response.writeHead(200, {
        "Content-Type": fileName.endsWith(".tgz") ? "application/gzip" : "application/octet-stream",
        "Content-Length": String(body.byteLength)
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind local artifact server");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise))
  };
}

function getManifestVersion(manifest) {
  const versions = unique((manifest.packages || []).map((item) => item.version));
  if (versions.length !== 1) {
    throw new Error(`Expected one aligned foundation package version, got: ${versions.join(", ") || "(none)"}`);
  }
  return versions[0];
}

function assertCapabilityRegistry(manifest, registry) {
  const manifestVersion = getManifestVersion(manifest);
  if (registry.foundationVersion !== manifestVersion) {
    throw new Error(`Capability registry version ${registry.foundationVersion} does not match manifest version ${manifestVersion}`);
  }
  const capabilityIds = new Set(registry.capabilities.map((item) => item.id));
  const requiredCapabilities = ["package-consumption", "app-shell", "http-and-upload", "desktop-core", "ci-and-release"];
  const missing = requiredCapabilities.filter((id) => !capabilityIds.has(id));
  if (missing.length) {
    throw new Error(`Capability registry is missing ${missing.join(", ")}`);
  }
  return {
    required: requiredCapabilities,
    missing,
    count: registry.capabilities.length
  };
}

function assertReleaseManifest(manifest, manifestPath) {
  if (!/^https?:\/\/github\.com\/.+\/releases\/download\/v/.test(manifestPath)) {
    return;
  }
  if (manifest.immutable !== true) {
    throw new Error("Release manifest must set immutable=true");
  }
  if (!manifest.releaseTag || !String(manifest.baseUrl || "").endsWith(`/${manifest.releaseTag}`)) {
    throw new Error("Release manifest must include releaseTag and a matching baseUrl");
  }
  for (const item of manifest.packages || []) {
    if (!String(item.url || "").startsWith(manifest.baseUrl)) {
      throw new Error(`Release manifest package URL must point at baseUrl: ${item.name}`);
    }
  }
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, url] of Object.entries(manifest.consumer?.[section] || {})) {
      if (!String(url).startsWith(manifest.baseUrl)) {
        throw new Error(`Release manifest ${section}.${name} must point at ${manifest.baseUrl}`);
      }
    }
  }
  for (const [name, url] of Object.entries(manifest.consumer?.pnpm?.overrides || {})) {
    if (!String(url).startsWith(manifest.baseUrl)) {
      throw new Error(`Release manifest pnpm.overrides.${name} must point at ${manifest.baseUrl}`);
    }
  }
  if (!String(manifest.capabilities?.url || "").startsWith(manifest.baseUrl)) {
    throw new Error("Release manifest capabilities.url must point at release baseUrl");
  }
}

function getCargoDependency(manifest) {
  return (
    manifest.consumer?.cargo?.dependency ||
    'desktop-core-rs = { git = "ssh://git@github.com/k2safe/desktop-foundation.git", branch = "main", package = "desktop-core-rs", features = ["tauri", "http-reqwest"] }'
  );
}

function createPackageJson(manifest) {
  const packageJson = {
    name: "df-external-ai-demo",
    private: true,
    version: "0.1.0",
    type: "module",
    packageManager: "pnpm@9.15.4",
    scripts: {
      dev: "vite --host 127.0.0.1",
      "type-check": "tsc -p tsconfig.json --noEmit",
      build: "pnpm type-check && vite build",
      "integration-check":
        "desktop-foundation-ci --integration-check --integration-summary --integration-report artifacts/foundation-integration.json",
      "visual:regression": "node scripts/visual-regression.mjs",
      "package:desktop":
        "desktop-foundation-ci --no-type-check --no-build --package-desktop --manifest --release-plan --github-repo k2safe/desktop-foundation",
      "release:manifest":
        "desktop-foundation-ci --no-type-check --no-build --manifest --release-plan --github-repo k2safe/desktop-foundation",
      "upload:smoke": "node scripts/upload-smoke.mjs"
    },
    dependencies: {
      ...manifest.consumer.dependencies,
      react: "^19.0.1",
      "react-dom": "^19.0.1"
    },
    devDependencies: {
      ...manifest.consumer.devDependencies,
      "@types/react": "^19.2.15",
      "@types/react-dom": "^19.2.3",
      typescript: "~5.8.2",
      vite: "^6.0.0"
    },
    pnpm: manifest.consumer.pnpm
  };
  assertNoWorkspaceReferences(packageJson);
  return packageJson;
}

async function writeProject(baseDir, manifest) {
  const foundationVersion = getManifestVersion(manifest);
  const cargoDependency = getCargoDependency(manifest);
  const packageJson = createPackageJson(manifest);

  await writeText(baseDir, "package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeText(
    baseDir,
    "tsconfig.json",
    `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`
  );
  await writeText(
    baseDir,
    "index.html",
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>External AI Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );
  await writeText(
    baseDir,
    "src/main.tsx",
    `import "@desktop-foundation/ui-react/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
  );
  await writeText(
    baseDir,
    "src/product-adapter.tsx",
    `import { createGitHubReleasesUpdateConfig, type DesktopClientConfig } from "@desktop-foundation/bridge";
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";
import type { DesktopLayoutBrand, DesktopMenuItem, DesktopUserMenuItem } from "@desktop-foundation/ui-react";

export const foundationVersion = ${JSON.stringify(foundationVersion)};

export const productTemplate = createThemeTemplateRuntime("admin", {
  brand: { name: "External AI Demo" },
  colors: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#dbeafe"
  }
});

export const brand: DesktopLayoutBrand = {
  name: "External AI Demo",
  mark: <span aria-hidden="true">DF</span>
};

export const menus: DesktopMenuItem[] = [
  { id: "dashboard", label: "Dashboard", active: true },
  { id: "uploads", label: "Uploads" },
  { id: "settings", label: "Settings" }
];

export const userMenuItems: DesktopUserMenuItem[] = [
  { id: "profile", label: "Profile", description: "Product-owned action" },
  { id: "support", label: "Support", description: "External demo support" }
];

export const clientConfig: DesktopClientConfig = {
  product: "external-ai-demo",
  version: "0.1.0",
  apiBaseURL: "http://127.0.0.1:19020",
  updateConfig: createGitHubReleasesUpdateConfig({
    repository: "k2safe/desktop-foundation",
    channel: "stable",
    requireChecksumVerification: true
  }),
  security: {
    allowedRequestOrigins: [
      "127.0.0.1",
      "localhost",
      "github.com",
      "raw.githubusercontent.com",
      "objects.githubusercontent.com",
      "github-releases.githubusercontent.com"
    ],
    allowedExternalOrigins: ["github.com", "docs.github.com"],
    allowedExternalSchemes: ["https"],
    allowedDownloadDirectories: ["/tmp", "/private/tmp"]
  }
};
`
  );
  await writeText(
    baseDir,
    "src/pages/DashboardPage.tsx",
    `import { Button, CodeBlock, ContentPanel, DataTable, MetricGrid, StatusTag, type TableColumn } from "@desktop-foundation/ui-react";
import { foundationVersion } from "../product-adapter";

interface DemoUploadRow {
  id: string;
  fileName: string;
  status: "ready" | "verified" | "queued";
  size: string;
}

const rows: DemoUploadRow[] = [
  { id: "REL-020", fileName: "desktop-release.zip", status: "verified", size: "34 KB" },
  { id: "REL-021", fileName: "manifest.json", status: "ready", size: "2 KB" },
  { id: "REL-022", fileName: "checksum.sha256", status: "queued", size: "1 KB" }
];

const columns: TableColumn<DemoUploadRow>[] = [
  { key: "id", header: "ID", accessor: "id", width: 120 },
  { key: "fileName", header: "File", accessor: "fileName" },
  { key: "status", header: "Status", render: (row) => <StatusTag status={row.status} /> },
  { key: "size", header: "Size", accessor: "size", align: "right", width: 120 }
];

export function DashboardPage({ onUpload }: { onUpload: () => void }) {
  return (
    <>
      <MetricGrid
        metrics={[
          { id: "packages", label: "Foundation packages", value: "5", hint: foundationVersion + " tarballs" },
          { id: "checks", label: "Integration checks", value: "Ready", hint: "contract gate" },
          { id: "uploads", label: "Upload smoke", value: "FormData", hint: "multipart path" }
        ]}
      />

      <ContentPanel
        title="External AI integration"
        description="This demo consumes desktop-foundation only through GitHub Release tarballs and the public package manifest."
        actions={<Button onClick={onUpload}>Run upload mock</Button>}
      >
        <DataTable columns={columns} rows={rows} rowKey="id" />
      </ContentPanel>

      <ContentPanel title="AI handoff inputs" description="The external project should not copy foundation source code.">
        <CodeBlock>{\`manifest: https://github.com/k2safe/desktop-foundation/releases/download/v${foundationVersion}/foundation-packages.json
docs: https://github.com/k2safe/desktop-foundation/blob/main/integration-kit/for-ai-short.md
validation: pnpm exec desktop-foundation-ci --integration-check --integration-summary\`}</CodeBlock>
      </ContentPanel>
    </>
  );
}
`
  );
  await writeText(
    baseDir,
    "src/App.tsx",
    `import { useMemo, useState } from "react";
import { DesktopAppShell, DesktopLoginPage, useDesktopClient } from "@desktop-foundation/app-shell";
import { Button, DesktopLayout, OfflineBanner, PageHeader, useToast } from "@desktop-foundation/ui-react";
import { brand, clientConfig, foundationVersion, menus, productTemplate, userMenuItems } from "./product-adapter";
import { DashboardPage } from "./pages/DashboardPage";

function Workspace() {
  const client = useDesktopClient();
  const toast = useToast();

  async function runUploadMock() {
    const form = new FormData();
    form.append("release", foundationVersion);
    form.append("package", new Blob(["zip bytes from external AI demo"], { type: "application/zip" }), "desktop-release.zip");

    try {
      await client.http.post("/upload", form, { auth: false, requestId: "external-demo-upload" });
      toast.notify({
        title: "Upload request sent",
        description: "Run pnpm upload:smoke for the local mock server verification.",
        tone: "success"
      });
    } catch (error) {
      toast.notify({
        title: "Upload mock server is not running",
        description: error instanceof Error ? error.message : "Start pnpm upload:smoke to verify the full path.",
        tone: "warning"
      });
    }
  }

  return (
    <DesktopLayout
      variant={productTemplate.layout.appShell}
      brand={brand}
      menus={menus}
      user={{ name: "External AI", role: "Integrator" }}
      userMenuItems={userMenuItems}
      topbarRight={
        <Button variant="outline" size="sm" onClick={() => void client.updates.checkForUpdate()}>
          Check updates
        </Button>
      }
    >
      <PageHeader title="External demo workspace" description="A clean product shell wired from GitHub-published foundation packages." />
      <OfflineBanner visible={false} message="Connected to local demo bridge" />
      <DashboardPage onUpload={() => void runUploadMock()} />
    </DesktopLayout>
  );
}

export function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const client = useMemo(() => clientConfig, []);

  return (
    <DesktopAppShell theme={productTemplate.theme} className={productTemplate.className} client={client}>
      {authenticated ? (
        <Workspace />
      ) : (
        <DesktopLoginPage
          brand={brand}
          template={productTemplate.layout.login}
          title="External AI Demo"
          subtitle="Use this product-owned login shell to enter the external integration workspace."
          login={{
            defaultPayload: { account: "demo", password: "demo", remember: true },
            login: async (_client, payload) => {
              if (!payload.account || !payload.password) throw new Error("Account and password are required");
              setAuthenticated(true);
              return {
                token: "external-demo-token",
                remember: payload.remember,
                user: { id: "external-ai", name: "External AI", role: "Integrator" }
              };
            }
          }}
        />
      )}
    </DesktopAppShell>
  );
}
`
  );
  await writeText(
    baseDir,
    "scripts/upload-smoke.mjs",
    `#!/usr/bin/env node
import { createServer } from "node:http";
import { createDesktopClient } from "@desktop-foundation/bridge";

const expected = {
  release: ${JSON.stringify(foundationVersion)},
  fileName: "desktop-release.zip",
  fileBody: "zip bytes from external AI demo"
};

function validateMultipart(request) {
  const body = request.body.toString("latin1");
  const failures = [];
  if (!request.contentType.includes("multipart/form-data")) failures.push("missing multipart content type");
  if (!request.contentType.includes("boundary=")) failures.push("missing boundary");
  if (!body.includes('name="release"') || !body.includes(expected.release)) failures.push("missing release field");
  if (!body.includes('name="package"') || !body.includes(\`filename="\${expected.fileName}"\`)) failures.push("missing package file");
  if (!body.includes("application/zip")) failures.push("missing file content type");
  if (!body.includes(expected.fileBody)) failures.push("missing file body");
  return failures;
}

async function startServer() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const captured = {
      method: request.method,
      url: request.url,
      contentType: String(request.headers["content-type"] || ""),
      body: Buffer.concat(chunks)
    };
    captured.failures = validateMultipart(captured);
    requests.push(captured);

    const ok = request.method === "POST" && request.url === "/upload" && captured.failures.length === 0;
    response.writeHead(ok ? 200 : 400, { "Content-Type": "application/json", "x-request-id": "external-upload-smoke" });
    response.end(JSON.stringify(ok ? { code: 200, data: { ok: true, bytes: captured.body.length } } : { code: 400, message: captured.failures.join("; ") }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind local upload server");
  return {
    baseURL: \`http://127.0.0.1:\${address.port}\`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function memoryStore() {
  const values = new Map();
  return {
    get: (key) => (values.has(key) ? values.get(key) : null),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key)
  };
}

function memoryAsyncStore() {
  const store = memoryStore();
  return {
    get: async (key) => store.get(key),
    set: async (key, value) => {
      store.set(key, value);
    },
    remove: async (key) => {
      store.remove(key);
    }
  };
}

function noopSession() {
  return {
    getToken: () => null,
    setToken: () => undefined,
    clearToken: () => undefined
  };
}

function noopDesktop() {
  return {
    openExternal: async () => undefined,
    copyText: async () => undefined,
    notify: async () => undefined,
    getWindowState: async () => null,
    setWindowState: async () => undefined,
    setWindowTitle: async () => undefined
  };
}

function noopFiles() {
  return {
    openFileDialog: async () => ({ paths: [], canceled: true }),
    saveFileDialog: async () => ({ path: null, canceled: true }),
    readTextFile: async () => "",
    writeTextFile: async (path) => path,
    exportJson: async (fileName) => fileName,
    downloadFile: async () => ({ path: "download.bin", bytes: 0, status: 200 })
  };
}

const server = await startServer();
const client = createDesktopClient({
  product: "external-ai-demo",
  apiBaseURL: server.baseURL,
  session: noopSession(),
  storage: memoryStore(),
  secureStorage: memoryAsyncStore(),
  desktop: noopDesktop(),
  files: noopFiles(),
  security: {
    allowedRequestOrigins: ["127.0.0.1"]
  }
});

try {
  const form = new FormData();
  form.append("release", expected.release);
  form.append("package", new Blob([expected.fileBody], { type: "application/zip" }), expected.fileName);

  const reply = await client.http.post("/upload", form, { auth: false, requestId: "external-upload-smoke" });
  if (!reply?.ok) throw new Error("Upload smoke did not return ok=true");

  const request = server.requests.at(-1);
  if (!request) throw new Error("Local upload server did not receive a request");
  console.log("external demo upload smoke: ok");
  console.log(\`- received \${request.body.length} bytes\`);
  console.log(\`- \${request.contentType}\`);
} finally {
  await server.close();
}
`
  );
  await writeText(
    baseDir,
    "scripts/visual-regression.mjs",
    `#!/usr/bin/env node
console.log("external demo visual regression skipped; no baseline is configured for smoke generation.");
`
  );
  await writeText(
    baseDir,
    "src-tauri/Cargo.toml",
    `[package]
name = "df-external-ai-demo"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = [] }
${cargoDependency}
`
  );
  await writeText(
    baseDir,
    "src-tauri/tauri.conf.json",
    `{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "External AI Demo",
  "version": "0.1.0",
  "identifier": "com.desktopfoundation.external-ai-demo",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://127.0.0.1:5173"
  },
  "app": {
    "windows": [
      {
        "title": "External AI Demo",
        "width": 1280,
        "height": 820
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
`
  );
  await writeText(
    baseDir,
    "src-tauri/capabilities/default.json",
    `{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default desktop foundation capability set for the external demo smoke.",
  "windows": ["main"],
  "permissions": ["core:default", "desktop-core:default"]
}
`
  );
}

async function main() {
  const startedAt = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const report = createReport(options);
  report.proxy = options.proxy || null;
  let artifactServer = null;
  let demoDir = null;
  let succeeded = false;

  try {
    let manifest = await runReported(report, "manifest", async () => {
      const nextManifest = await readManifest(options.manifestPath, options);
      assertReleaseManifest(nextManifest, options.manifestPath);
      report.foundationVersion = getManifestVersion(nextManifest);
      return nextManifest;
    });

    if (options.localArtifacts && /^https?:\/\//.test(options.manifestPath)) {
      throw new Error("--local-artifacts requires a local manifest path");
    }
    artifactServer = options.localArtifacts
      ? await runReported(report, "local-artifact-server", async () => startArtifactServer(dirname(options.manifestPath)))
      : null;
    if (artifactServer) manifest = rewriteManifestUrls(manifest, artifactServer.baseUrl);

    const capabilityRegistry = await runReported(report, "capability-registry", async () => readCapabilityRegistry(manifest, options));
    report.capabilities = assertCapabilityRegistry(manifest, capabilityRegistry);

    demoDir = options.dir || (await mkdtemp(resolve(tmpdir(), "df-external-ai-demo-")));
    report.workspace = demoDir;

    if (options.dir) {
      if (existsSync(demoDir)) {
        throw new Error(`--dir target already exists; choose a new empty path: ${demoDir}`);
      }
      await mkdir(demoDir, { recursive: true });
    }

    console.log(`external-ai-demo: manifest ${options.manifestPath}`);
    if (artifactServer) console.log(`external-ai-demo: local artifact server ${artifactServer.baseUrl}`);
    console.log(`external-ai-demo: workspace ${demoDir}`);
    console.log(`external-ai-demo: foundation ${report.foundationVersion}`);
    console.log(`external-ai-demo: capabilities ${capabilityRegistry.capabilities.length}`);

    await runReported(report, "write-project", async () => writeProject(demoDir, manifest));
    await runReported(report, "package-reference-scan", async () =>
      assertFileDoesNotContain(resolve(demoDir, "package.json"), ["workspace:", "link:", "file:"])
    );
    await runReported(report, "pnpm-install", async () =>
      run("pnpm", ["install", "--fetch-timeout=120000", "--fetch-retries=5"], demoDir, options)
    );
    await runReported(report, "lockfile-reference-scan", async () =>
      assertFileDoesNotContain(resolve(demoDir, "pnpm-lock.yaml"), ["workspace:", "link:", repoRoot])
    );
    await runReported(report, "integration-check", async () => run("pnpm", ["integration-check"], demoDir, options));
    await runReported(report, "build", async () => run("pnpm", ["build"], demoDir, options));
    await runReported(report, "upload-smoke", async () => run("pnpm", ["upload:smoke"], demoDir, options));
    succeeded = true;
    report.ok = true;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\nexternal-ai-demo smoke: ok (${seconds}s)`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (demoDir && !options.keep && succeeded) {
      await rm(demoDir, { recursive: true, force: true });
      console.log(`external-ai-demo: cleaned ${demoDir}`);
    } else if (demoDir) {
      console.log(`external-ai-demo: kept ${demoDir}`);
    }
    await artifactServer?.close();
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAt;
    await writeReport(options.reportPath, report);
    if (options.reportPath) console.log(`external-ai-demo: report ${options.reportPath}`);
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
