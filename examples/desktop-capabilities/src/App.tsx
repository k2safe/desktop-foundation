import "@desktop-foundation/ui-react/styles.css";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  createDesktopClient,
  normalizeDesktopError,
  type AsyncKeyValueStore,
  type DesktopCapability,
  type DesktopClient,
  type FileCapability,
  type HttpTransport,
  type HttpTransportRequest,
  type KeyValueStore,
  type SessionStore
} from "@desktop-foundation/bridge";
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { adminThemePreset } from "@desktop-foundation/theme-presets";
import {
  Button,
  CodeBlock,
  CommandPalette,
  DataTable,
  DesktopLayout,
  DetailDrawer,
  MetricGrid,
  PageHeader,
  SettingsPage,
  StatusTag,
  useLocale,
  type CommandPaletteItem,
  type DesktopMenuItem,
  type TableColumn
} from "@desktop-foundation/ui-react";

type SmokeStatus = "idle" | "running" | "success" | "failed";

interface SmokeResult {
  status: SmokeStatus;
  message?: string;
  detail?: unknown;
  durationMs?: number;
  ranAt?: string;
}

interface CapabilitySmoke {
  id: string;
  group: string;
  name: string;
  owner: "foundation" | "shared";
  intent: string;
  command?: string;
  run: () => Promise<unknown>;
}

interface CapabilityRow {
  id: string;
  group: string;
  name: string;
  owner: string;
  status: SmokeStatus;
  message: string;
  durationMs?: number;
}

interface DryRunInstallResult {
  targetPath?: string;
  relaunchRequired?: boolean;
  status?: string;
}

const menus: DesktopMenuItem[] = [
  { id: "smoke", label: "Smoke matrix", active: true },
  { id: "diagnostics", label: "Diagnostics" }
];

const demoUpdateSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

function demoSession(pushLog: (value: string) => void): SessionStore {
  let token: string | null = "demo-token";
  return {
    getToken: () => token,
    setToken: (nextToken, remember) => {
      token = nextToken;
      pushLog(`session.setToken remember=${Boolean(remember)}`);
    },
    clearToken: () => {
      token = null;
      pushLog("session.clearToken");
    }
  };
}

function bodyKind(value: unknown) {
  if (typeof FormData !== "undefined" && value instanceof FormData) return "FormData";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

function demoTransport(pushLog: (value: string) => void): HttpTransport {
  return {
    async request<T>(request: HttpTransportRequest) {
      pushLog(`http.${request.method} ${request.url}`);
      if (request.url.endsWith("/latest.json")) {
        return {
          version: "1.0.1",
          channel: "stable",
          notes: "Dry-run update package for desktop-core installer validation.",
          releasePageUrl: "https://docs.example.com/releases/v1.0.1",
          downloadUrl: "https://updates.example.com/DesktopFoundation-1.0.1-macos.zip",
          size: 128,
          sha256: demoUpdateSha256,
          metadata: {
            appName: "Desktop Foundation",
            targetPath: "/Applications/Desktop Foundation.app",
            relaunch: true,
            backup: true
          }
        } as T;
      }
      return {
        ok: true,
        method: request.method,
        url: request.url,
        requestId: request.requestId,
        namespace: request.namespace,
        bodyKind: bodyKind(request.body),
        query: request.query
      } as T;
    }
  };
}

function demoDesktop(pushLog: (value: string) => void): DesktopCapability {
  return {
    async openExternal(url) {
      pushLog(`desktop.openExternal ${url}`);
    },
    async copyText(text) {
      pushLog(`desktop.copyText length=${text.length}`);
    },
    async notify(options) {
      pushLog(`desktop.notify ${options.title}`);
    },
    async getWindowState() {
      pushLog("desktop.getWindowState");
      return { x: 12, y: 24, width: 1280, height: 820, maximized: false, fullscreen: false };
    },
    async setWindowState(state) {
      pushLog(`desktop.setWindowState ${JSON.stringify(state)}`);
    },
    async setWindowTitle(title) {
      pushLog(`desktop.setWindowTitle ${title}`);
    }
  };
}

function demoFiles(pushLog: (value: string) => void): FileCapability {
  return {
    async openFileDialog(options) {
      pushLog(`files.openFileDialog ${options?.directory ?? ""}`);
      return { paths: ["/tmp/capabilities/input.csv"], canceled: false };
    },
    async saveFileDialog(options) {
      pushLog(`files.saveFileDialog ${options?.defaultFileName ?? ""}`);
      return { path: "/tmp/capabilities/export.json", canceled: false };
    },
    async readTextFile(path) {
      pushLog(`files.readTextFile ${path}`);
      return "id,name\n1,desktop-foundation";
    },
    async writeTextFile(path, content) {
      pushLog(`files.writeTextFile ${path} bytes=${content.length}`);
      return path;
    },
    async exportJson(fileName, data) {
      pushLog(`files.exportJson ${fileName}`);
      return `/tmp/capabilities/${fileName}`;
    },
    async downloadFile(url, options) {
      pushLog(`files.downloadFile ${url}`);
      return {
        path: options?.path ?? `/tmp/capabilities/${options?.fileName ?? "DesktopFoundation-1.0.1-macos.zip"}`,
        bytes: 128,
        status: 200,
        sha256: demoUpdateSha256,
        requestId: options?.requestId
      };
    }
  };
}

function shortJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function resultMessage(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("message" in value && typeof value.message === "string") return value.message;
    if ("status" in value && typeof value.status === "string") return value.status;
    if ("ok" in value) return "ok";
  }
  return "ok";
}

function createMultipartBody() {
  const form = new FormData();
  form.append("purpose", "desktop-capabilities");
  form.append("release", "v0.1.30");
  return form;
}

function CapabilitiesWorkbench({
  client,
  logs,
  pushLog
}: {
  client: DesktopClient;
  logs: string[];
  pushLog: (value: string) => void;
}) {
  const { t, format } = useLocale();
  const [results, setResults] = useState<Record<string, SmokeResult>>({});
  const [selectedId, setSelectedId] = useState<string | null>("http-json");
  const [settingsSection, setSettingsSection] = useState("results");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  const smokes = useMemo<CapabilitySmoke[]>(
    () => [
      {
        id: "http-json",
        group: "Network",
        name: "HTTP JSON",
        owner: "foundation",
        intent: "Uses client.http with auth, request logging, and origin policy.",
        run: () => client.http.get("/capabilities/health", { requestId: "smoke-http-json" })
      },
      {
        id: "http-multipart",
        group: "Network",
        name: "Multipart upload",
        owner: "foundation",
        intent: "Sends FormData through the shared HTTP surface without business code setting Content-Type.",
        run: () => client.http.post("/capabilities/upload", createMultipartBody(), { requestId: "smoke-http-multipart" })
      },
      {
        id: "session-storage",
        group: "State",
        name: "Session and storage",
        owner: "foundation",
        intent: "Checks token, user storage, and secure storage boundaries.",
        run: async () => {
          client.session.setToken("next-token", true);
          client.storage.set("density", "compact");
          await client.secureStorage.set("refresh-token", { stored: true });
          return {
            token: client.session.getToken(),
            density: client.storage.get("density"),
            secure: await client.secureStorage.get("refresh-token")
          };
        }
      },
      {
        id: "files",
        group: "Desktop",
        name: "Files and download",
        owner: "foundation",
        intent: "Exercises dialogs, read/write, JSON export, and download guards.",
        run: async () => {
          const opened = await client.files.openFileDialog({ directory: "/tmp/capabilities", multiple: false });
          const saved = await client.files.saveFileDialog({ directory: "/tmp/capabilities", defaultFileName: "capabilities.json" });
          const written = await client.files.writeTextFile("/tmp/capabilities/readme.txt", "desktop foundation smoke", { createDir: true });
          const content = await client.files.readTextFile(written);
          const exported = await client.files.exportJson("capabilities.json", { opened, saved }, { directory: "/tmp/capabilities" });
          const downloaded = await client.files.downloadFile("https://updates.example.com/manual.zip", {
            directory: "/tmp/capabilities",
            fileName: "manual.zip",
            auth: false,
            requestId: "smoke-download"
          });
          return { opened, saved, written, content, exported, downloaded };
        }
      },
      {
        id: "desktop",
        group: "Desktop",
        name: "Desktop commands",
        owner: "foundation",
        intent: "Checks open external, clipboard, notification, and window command wrappers.",
        run: async () => {
          await client.desktop.copyText("desktop-foundation");
          await client.desktop.notify({ title: "Capability smoke", body: "Desktop command bridge is ready." });
          await client.desktop.openExternal("https://docs.example.com/desktop-foundation");
          const before = await client.desktop.getWindowState() ?? { x: 0, y: 0, width: 1280, height: 820, maximized: false, fullscreen: false };
          await client.desktop.setWindowTitle("Desktop Foundation Smoke");
          await client.desktop.setWindowState({ width: before.width, height: before.height, maximized: before.maximized });
          return before;
        }
      },
      {
        id: "updates",
        group: "Release",
        name: "Update install boundary",
        owner: "shared",
        command: "df_update_install dry-run",
        intent: "Runs manifest check, package download, and installUpdate through the adapter boundary.",
        run: async () => {
          const check = await client.updates.checkForUpdate();
          if (!check.update) return check;
          const downloaded = await client.updates.downloadUpdate(check.update, {
            directory: "/tmp/capabilities",
            auth: false,
            requestId: "smoke-update-download"
          });
          const installed = await client.updates.installUpdate(check.update);
          return { check, downloaded, installed, state: client.updates.getState() };
        }
      },
      {
        id: "link-proxy",
        group: "Network",
        name: "Link proxy",
        owner: "shared",
        intent: "Validates direct target allowlist and gateway-ready request shape.",
        run: async () => {
          const direct = await client.linkProxy.request("https://status.example.com/health", {
            mode: "direct",
            requestId: "smoke-link-direct"
          });
          await client.linkProxy.open("https://docs.example.com/releases");
          return { direct, resolved: client.linkProxy.resolve("https://status.example.com/health") };
        }
      },
      {
        id: "i18n-audit",
        group: "Diagnostics",
        name: "i18n and audit",
        owner: "shared",
        intent: "Checks common formatters, missing-key diagnostics, and audit buffer.",
        run: async () => {
          const missing = t("capabilities.missing.demo", { id: 30 }, "missing fallback {id}");
          const amount = format.currency(1288.5, "USD");
          const date = format.dateTime("2026-06-04T10:00:00Z");
          client.diagnostics.recordAuditEvent({
            action: "capability.smoke.manual",
            ok: true,
            metadata: { missing, amount, date }
          });
          return {
            missing,
            amount,
            date,
            audits: client.diagnostics.getRecentAuditEvents().length,
            requests: client.diagnostics.getRecentRequests().length
          };
        }
      }
    ],
    [client, format, t]
  );

  const selected = smokes.find((item) => item.id === selectedId) ?? smokes[0];
  const counts = smokes.reduce(
    (acc, smoke) => {
      const status = results[smoke.id]?.status ?? "idle";
      acc[status] += 1;
      return acc;
    },
    { idle: 0, running: 0, success: 0, failed: 0 } as Record<SmokeStatus, number>
  );
  const rows = smokes.map<CapabilityRow>((smoke) => {
    const result = results[smoke.id];
    return {
      id: smoke.id,
      group: smoke.group,
      name: smoke.name,
      owner: smoke.owner,
      status: result?.status ?? "idle",
      message: result?.message ?? smoke.intent,
      durationMs: result?.durationMs
    };
  });

  const columns: TableColumn<CapabilityRow>[] = [
    { key: "group", header: "Group", accessor: "group", width: 120 },
    { key: "name", header: "Capability", accessor: "name", width: 220 },
    { key: "owner", header: "Owner", accessor: "owner", width: 110 },
    { key: "status", header: "Status", render: (row) => <StatusTag status={row.status} label={row.status} />, width: 120 },
    { key: "message", header: "Latest result", accessor: "message" },
    {
      key: "duration",
      header: "Duration",
      align: "right",
      width: 110,
      render: (row) => (typeof row.durationMs === "number" ? `${row.durationMs} ms` : "-")
    },
    {
      key: "action",
      header: "Run",
      width: 110,
      render: (row) => (
        <Button size="sm" variant="secondary" loading={results[row.id]?.status === "running"} onClick={() => void runSmoke(row.id)}>
          Run
        </Button>
      )
    }
  ];

  const commands: CommandPaletteItem[] = [
    { id: "run-all", label: "Run all smoke checks", group: "Smoke", shortcut: "A" },
    ...smokes.map((smoke) => ({ id: smoke.id, label: `Run ${smoke.name}`, group: smoke.group }))
  ];

  async function runSmoke(id: string) {
    const smoke = smokes.find((item) => item.id === id);
    if (!smoke) return;
    const startedAt = performance.now();
    setResults((current) => ({
      ...current,
      [id]: { status: "running", message: "Running", ranAt: new Date().toISOString() }
    }));
    try {
      const detail = await smoke.run();
      const durationMs = Math.round(performance.now() - startedAt);
      setResults((current) => ({
        ...current,
        [id]: {
          status: "success",
          message: resultMessage(detail),
          detail,
          durationMs,
          ranAt: new Date().toISOString()
        }
      }));
      pushLog(`smoke.${id} success ${durationMs}ms`);
    } catch (error) {
      const normalized = normalizeDesktopError(error);
      const durationMs = Math.round(performance.now() - startedAt);
      setResults((current) => ({
        ...current,
        [id]: {
          status: "failed",
          message: normalized.message,
          detail: normalized,
          durationMs,
          ranAt: new Date().toISOString()
        }
      }));
      pushLog(`smoke.${id} failed ${normalized.code ?? normalized.message}`);
    }
  }

  async function runAll() {
    for (const smoke of smokes) {
      await runSmoke(smoke.id);
    }
  }

  function selectCommand(item: CommandPaletteItem) {
    setPaletteOpen(false);
    if (item.id === "run-all") {
      void runAll();
    } else {
      setSelectedId(item.id);
      void runSmoke(item.id);
    }
  }

  const selectedResult = results[selected.id];
  const installResult = results.updates?.detail as { installed?: DryRunInstallResult } | undefined;
  const releaseTarget = installResult?.installed?.targetPath ?? "/Applications/Desktop Foundation.app";

  return (
    <DesktopLayout brand={{ name: "Desktop Foundation" }} menus={menus} user={{ name: "Demo", role: "Foundation QA" }}>
      <PageHeader
        title="Desktop capability smoke"
        description="Runnable checks for bridge, desktop-core, app shell diagnostics, update install boundary, and integration policy."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPaletteOpen(true)}>
              Command
            </Button>
            <Button onClick={() => void runAll()}>Run all</Button>
          </>
        }
      />

      <MetricGrid
        metrics={[
          { id: "success", label: "Passed", value: counts.success, hint: "smoke checks" },
          { id: "running", label: "Running", value: counts.running, hint: "in progress" },
          { id: "failed", label: "Failed", value: counts.failed, hint: "needs fix" },
          { id: "release", label: "Install target", value: releaseTarget, hint: "dry-run targetPath" }
        ]}
      />

      <DataTable columns={columns} rows={rows} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} />

      <SettingsPage
        activeSectionId={settingsSection}
        onSectionSelect={(section) => setSettingsSection(section.id)}
        sections={[
          {
            id: "results",
            title: "Results",
            description: "Selected smoke output.",
            content: <CodeBlock>{shortJson(selectedResult?.detail ?? selected.intent)}</CodeBlock>
          },
          {
            id: "requests",
            title: "Requests",
            description: "Recent bridge requests.",
            content: <CodeBlock>{shortJson(client.diagnostics.getRecentRequests())}</CodeBlock>
          },
          {
            id: "audit",
            title: "Audit",
            description: "Recent foundation audit events.",
            content: <CodeBlock>{shortJson(client.diagnostics.getRecentAuditEvents())}</CodeBlock>
          },
          {
            id: "logs",
            title: "Logs",
            description: "Adapter call trace.",
            content: <CodeBlock>{logs.join("\n") || "No calls yet"}</CodeBlock>
          }
        ]}
      />

      <DetailDrawer
        open={Boolean(selected)}
        title={selected.name}
        subtitle={selected.group}
        rows={[
          { label: "Owner", value: selected.owner },
          { label: "Status", value: selectedResult?.status ?? "idle" },
          { label: "Command", value: selected.command ?? "client boundary" },
          { label: "Last run", value: selectedResult?.ranAt ?? "not run" },
          { label: "Intent", value: selected.intent as ReactNode }
        ]}
        actions={[{ id: "run", label: "Run smoke", onClick: () => void runSmoke(selected.id) }]}
        onClose={() => setSelectedId(null)}
      />

      <CommandPalette
        open={paletteOpen}
        items={commands}
        value={query}
        onValueChange={setQuery}
        onClose={() => setPaletteOpen(false)}
        onSelect={selectCommand}
      />
    </DesktopLayout>
  );
}

export function App() {
  const [logs, setLogs] = useState<string[]>([]);

  const pushLog = useCallback((value: string) => {
    setLogs((current) => [`${new Date().toISOString()} ${value}`, ...current].slice(0, 18));
  }, []);

  const client = useMemo(
    () =>
      createDesktopClient({
        product: "desktop-capabilities-demo",
        apiBaseURL: "https://api.example.com",
        version: "1.0.0",
        session: demoSession(pushLog),
        storage: memoryStore({ locale: "zh-CN" }),
        secureStorage: memorySecureStore(),
        transport: demoTransport(pushLog),
        desktop: demoDesktop(pushLog),
        files: demoFiles(pushLog),
        updateConfig: {
          manifestUrl: "https://updates.example.com/latest.json",
          currentVersion: "1.0.0",
          channel: "stable",
          requireChecksumVerification: true,
          installUpdate: async ({ downloadedPath, update }) => {
            pushLog(`updates.installUpdate dry-run ${downloadedPath ?? "missing"}`);
            return {
              status: "installing",
              message: "Dry-run installer staged through the update install boundary.",
              path: downloadedPath,
              targetPath: String(update.metadata?.targetPath ?? "/Applications/Desktop Foundation.app"),
              relaunchRequired: Boolean(update.metadata?.relaunch ?? true)
            };
          }
        },
        linkProxy: {
          mode: "direct"
        },
        security: {
          allowedRequestOrigins: ["api.example.com", "updates.example.com"],
          allowedExternalOrigins: ["docs.example.com"],
          allowedExternalSchemes: ["https"],
          allowedDownloadDirectories: ["/tmp"],
          allowedLinkProxyOrigins: ["api.example.com"],
          allowedLinkTargetOrigins: ["status.example.com", "docs.example.com"]
        },
        onAuditEvent: (event) => pushLog(`audit.${event.action} ok=${event.ok ?? "n/a"}`),
        maxRequestLogEntries: 30,
        maxAuditEvents: 40
      }),
    [pushLog]
  );

  return (
    <DesktopAppShell
      theme={adminThemePreset}
      client={client}
      locale="zh-CN"
      formatDefaults={{ currency: "USD", timeZone: "Asia/Shanghai" }}
      onMissingLocaleKey={(event) => pushLog(`i18n.missing ${event.key}`)}
    >
      <CapabilitiesWorkbench client={client} logs={logs} pushLog={pushLog} />
    </DesktopAppShell>
  );
}
