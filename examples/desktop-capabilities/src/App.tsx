import "@desktop-foundation/ui-react/styles.css";
import { useMemo, useState } from "react";
import {
  createDesktopClient,
  type AsyncKeyValueStore,
  type DesktopCapability,
  type FileCapability,
  type HttpTransport,
  type HttpTransportRequest,
  type KeyValueStore,
  type SessionStore
} from "@desktop-foundation/bridge";
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { adminThemePreset } from "@desktop-foundation/theme-presets";
import {
  BulkActionBar,
  Button,
  CodeBlock,
  CommandPalette,
  DataTable,
  DesktopLayout,
  DetailDrawer,
  EditableTable,
  MetricGrid,
  PageHeader,
  SettingsPage,
  StatusTag,
  type CommandPaletteItem,
  type DesktopMenuItem,
  type EditableTableColumn,
  type TableColumn
} from "@desktop-foundation/ui-react";

interface DemoRow {
  id: string;
  name: string;
  status: string;
  amount: number;
}

const menus: DesktopMenuItem[] = [
  { id: "capabilities", label: "Capabilities", active: true },
  { id: "settings", label: "Settings" }
];

const rows: DemoRow[] = [
  { id: "CAP-1001", name: "HTTP request", status: "ready", amount: 320 },
  { id: "CAP-1002", name: "Secure storage", status: "ready", amount: 180 },
  { id: "CAP-1003", name: "File export", status: "ready", amount: 96 }
];

function memoryStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return {
    get: <T,>(key: string) => (values.has(key) ? (values.get(key) as T) : null),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key)
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

function demoSession(): SessionStore {
  let token: string | null = "demo-token";
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
      return {
        ok: true,
        method: request.method,
        url: request.url,
        requestId: request.requestId
      } as T;
    }
  };
}

function demoDesktop(pushLog: (value: string) => void): DesktopCapability {
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
      return { x: 0, y: 0, width: 1200, height: 780, maximized: false, fullscreen: false };
    },
    async setWindowState(state) {
      pushLog(`setWindowState ${JSON.stringify(state)}`);
    },
    async setWindowTitle(title) {
      pushLog(`setWindowTitle ${title}`);
    }
  };
}

function demoFiles(pushLog: (value: string) => void): FileCapability {
  return {
    async openFileDialog() {
      pushLog("openFileDialog");
      return { paths: ["/tmp/demo.csv"], canceled: false };
    },
    async saveFileDialog() {
      pushLog("saveFileDialog");
      return { path: "/tmp/export.json", canceled: false };
    },
    async readTextFile(path) {
      pushLog(`readTextFile ${path}`);
      return "id,name\n1,demo";
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
      return { path: "/tmp/demo.bin", bytes: 128, status: 200 };
    }
  };
}

export function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<DemoRow | null>(rows[0]);
  const [editableRows, setEditableRows] = useState(rows);
  const [settingsSection, setSettingsSection] = useState("runtime");

  const pushLog = (value: string) => setLogs((current: string[]) => [`${new Date().toISOString()} ${value}`, ...current].slice(0, 8));

  const client = useMemo(
    () =>
      createDesktopClient({
        product: "desktop-capabilities-demo",
        apiBaseURL: "https://api.example.com",
        session: demoSession(),
        storage: memoryStore(),
        secureStorage: memorySecureStore(),
        transport: demoTransport(),
        desktop: demoDesktop(pushLog),
        files: demoFiles(pushLog),
        security: {
          allowedRequestOrigins: ["api.example.com"],
          allowedExternalOrigins: ["docs.example.com"],
          allowedExternalSchemes: ["https"],
          allowedDownloadDirectories: ["/tmp"]
        }
      }),
    []
  );

  const commands: CommandPaletteItem[] = [
    { id: "request", label: "Run request", group: "Runtime", shortcut: "R" },
    { id: "export", label: "Export JSON", group: "Files", shortcut: "E" },
    { id: "notify", label: "Send notification", group: "Desktop", shortcut: "N" }
  ];

  const tableColumns: TableColumn<DemoRow>[] = [
    { key: "id", header: "ID", accessor: "id", width: 130 },
    { key: "name", header: "Capability", accessor: "name" },
    { key: "status", header: "Status", render: (row) => <StatusTag status={row.status} /> },
    { key: "amount", header: "Volume", accessor: "amount", align: "right" }
  ];

  const editableColumns: EditableTableColumn<DemoRow>[] = [
    { key: "name", header: "Name", accessor: "name" },
    {
      key: "status",
      header: "Status",
      accessor: "status",
      type: "select",
      options: [
        { value: "ready", label: "ready" },
        { value: "blocked", label: "blocked" }
      ]
    },
    { key: "amount", header: "Amount", accessor: "amount", type: "number", width: 140 }
  ];

  async function runCommand(id: string) {
    if (id === "request") await client.http.get("/demo");
    if (id === "export") await client.files.exportJson("capabilities.json", rows, { directory: "/tmp" });
    if (id === "notify") await client.desktop.notify({ title: "Desktop capability ready" });
    setPaletteOpen(false);
  }

  return (
    <DesktopAppShell theme={adminThemePreset} client={client}>
      <DesktopLayout brand={{ name: "Desktop Foundation" }} menus={menus} user={{ name: "Demo", role: "Operator" }}>
        <PageHeader
          title="Desktop capabilities"
          description="HTTP, secure storage, files, notification, windows, and reusable workbench components."
          actions={<Button onClick={() => setPaletteOpen(true)}>Command</Button>}
        />

        <MetricGrid
          metrics={[
            { id: "requests", label: "Requests", value: "12", hint: "diagnostics" },
            { id: "files", label: "Files", value: "4", hint: "exports" },
            { id: "secure", label: "Secrets", value: "3", hint: "secure keys" },
            { id: "windows", label: "Windows", value: "1", hint: "active" }
          ]}
        />

        <BulkActionBar
          selectedCount={selectedKeys.length}
          actions={[{ id: "export", label: "Export", onClick: () => void client.files.exportJson("selected.json", selectedKeys, { directory: "/tmp" }) }]}
          onClear={() => setSelectedKeys([])}
        />

        <DataTable
          columns={tableColumns}
          rows={rows}
          rowKey="id"
          selectable
          selectedRowKeys={selectedKeys}
          onSelectedRowKeysChange={(keys) => setSelectedKeys(keys)}
          onRowClick={(row) => setSelectedRow(row)}
        />

        <EditableTable
          columns={editableColumns}
          rows={editableRows}
          rowKey="id"
          onCellChange={(row, rowIndex, column, value) => {
            setEditableRows((current) =>
              current.map((item, index) => (index === rowIndex && column.accessor ? { ...item, [column.accessor]: value } : item))
            );
            pushLog(`edit ${row.id} ${column.key}=${value}`);
          }}
        />

        <SettingsPage
          activeSectionId={settingsSection}
          onSectionSelect={(section) => setSettingsSection(section.id)}
          sections={[
            { id: "runtime", title: "Runtime", description: "Desktop command wiring.", content: <CodeBlock>{JSON.stringify(client.diagnostics.getRecentRequests(), null, 2)}</CodeBlock> },
            { id: "logs", title: "Logs", description: "Capability calls.", content: <CodeBlock>{logs.join("\n") || "No calls yet"}</CodeBlock> }
          ]}
        />

        <DetailDrawer
          open={Boolean(selectedRow)}
          title={selectedRow?.name ?? ""}
          subtitle={selectedRow?.id}
          rows={[
            { label: "Status", value: selectedRow?.status },
            { label: "Amount", value: selectedRow?.amount }
          ]}
          actions={[{ id: "copy", label: "Copy ID", onClick: () => void client.desktop.copyText(selectedRow?.id ?? "") }]}
          onClose={() => setSelectedRow(null)}
        />

        <CommandPalette
          open={paletteOpen}
          items={commands}
          value={query}
          onValueChange={setQuery}
          onClose={() => setPaletteOpen(false)}
          onSelect={(item) => void runCommand(item.id)}
        />
      </DesktopLayout>
    </DesktopAppShell>
  );
}
