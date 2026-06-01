import "@desktop-foundation/ui-react/styles.css";
import { useMemo, useState } from "react";
import { AuthGuard, DebugPanel, DesktopAppShell, DesktopLoginPage, useSession } from "@desktop-foundation/app-shell";
import { Badge, Button, CommandPalette, DesktopLayout, LoadingBlock, type CommandPaletteItem, type DesktopMenuItem } from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { createDemoProductClient, loginDemoUser } from "./client";
import { createMenus, demoUser, type DemoScreen } from "./data";
import { Dashboard } from "./screens/Dashboard";
import { Orders } from "./screens/Orders";
import { Settings } from "./screens/Settings";
import { demoProductTheme } from "./theme";

interface ProductWorkspaceProps {
  client: DesktopClient;
  logs: string[];
}

function ProductWorkspace({ client, logs }: ProductWorkspaceProps) {
  const session = useSession();
  const [screen, setScreen] = useState<DemoScreen>("dashboard");
  const [debugOpen, setDebugOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteValue, setPaletteValue] = useState("");

  const commands: CommandPaletteItem[] = [
    { id: "dashboard", label: "打开工作台", group: "导航" },
    { id: "orders", label: "打开订单中心", group: "导航" },
    { id: "settings", label: "打开底座设置", group: "导航" },
    { id: "notify", label: "发送测试通知", group: "桌面能力" },
    { id: "export", label: "导出订单 JSON", group: "文件能力" }
  ];

  function handleMenuSelect(item: DesktopMenuItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") {
      setScreen(item.id);
    }
  }

  async function handleCommand(item: CommandPaletteItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") setScreen(item.id);
    if (item.id === "notify") await client.desktop.notify({ title: "Foundation demo", body: "Command palette works." });
    if (item.id === "export") await client.files.exportJson("orders.json", [], { directory: "/tmp" });
    setPaletteOpen(false);
  }

  return (
    <>
      <DesktopLayout
        brand={{ name: "Foundation Demo" }}
        menus={createMenus(screen)}
        user={{ name: session.user?.name ?? demoUser.name, role: session.user?.role ?? demoUser.role }}
        topbarRight={
          <>
            <Badge tone="success">Demo</Badge>
            <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)}>
              命令
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDebugOpen(true)}>
              Debug
            </Button>
          </>
        }
        onMenuSelect={handleMenuSelect}
        onLogout={session.clearSession}
      >
        {screen === "dashboard" ? <Dashboard client={client} logs={logs} onOpenCommands={() => setPaletteOpen(true)} /> : null}
        {screen === "orders" ? <Orders client={client} /> : null}
        {screen === "settings" ? <Settings client={client} logs={logs} /> : null}
      </DesktopLayout>
      <CommandPalette
        open={paletteOpen}
        items={commands}
        value={paletteValue}
        title="命令面板"
        placeholder="搜索命令"
        onValueChange={setPaletteValue}
        onSelect={(item) => void handleCommand(item)}
        onClose={() => setPaletteOpen(false)}
      />
      <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} appVersion="0.1.0" environment="demo-product" />
    </>
  );
}

export function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const client = useMemo(
    () =>
      createDemoProductClient((value) => {
        setLogs((current) => [`${new Date().toISOString()} ${value}`, ...current].slice(0, 10));
      }),
    []
  );

  return (
    <DesktopAppShell
      theme={demoProductTheme}
      client={client}
      session={{
        loadUser: async () => demoUser
      }}
    >
      <AuthGuard
        checkingFallback={<LoadingBlock rows={4} />}
        fallback={
          <DesktopLoginPage
            brand={{ name: "Foundation Demo" }}
            title="登录 DEMO 产品"
            subtitle="账号和密码任意填写，用来演示 app-shell 的登录与 session 流程。"
            visualTitle="Clean foundation, product-owned business."
            visualDescription="底座提供壳、组件、主题、客户端和桌面能力；产品只保留业务页面。"
            submitLabel="进入 DEMO"
            login={{ login: loginDemoUser, defaultPayload: { account: "demo", password: "demo", remember: true } }}
          />
        }
      >
        <ProductWorkspace client={client} logs={logs} />
      </AuthGuard>
    </DesktopAppShell>
  );
}
