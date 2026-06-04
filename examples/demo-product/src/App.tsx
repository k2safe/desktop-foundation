import "@desktop-foundation/ui-react/styles.css";
import { useMemo, useState } from "react";
import { AccessDeniedState, AccessGuard, AuthGuard, DebugPanel, DesktopAppShell, DesktopLoginPage, useSession } from "@desktop-foundation/app-shell";
import { Badge, Button, CommandPalette, DesktopLayout, LoadingBlock, type CommandPaletteItem, type DesktopMenuItem } from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { createDemoProductClient, loginDemoUser } from "./client";
import { createMenus, demoUser, type DemoScreen } from "./data";
import { Dashboard } from "./screens/Dashboard";
import { Orders } from "./screens/Orders";
import { Settings } from "./screens/Settings";
import { demoProductTemplate, demoProductTheme } from "./theme";

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
    { id: "orders", label: "打开订单中心", group: "导航", permission: "orders:read" },
    { id: "settings", label: "打开底座设置", group: "导航", permission: "settings:read" },
    { id: "notify", label: "发送测试通知", group: "桌面能力", feature: "desktopNotify" },
    { id: "export", label: "导出订单 JSON", group: "文件能力", permission: "orders:export" },
    { id: "review", label: "打开复核台", group: "实验功能", feature: "reviewWorkbench" }
  ];

  function handleMenuSelect(item: DesktopMenuItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") {
      setScreen(item.id);
    }
  }

  async function handleCommand(item: CommandPaletteItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") setScreen(item.id);
    if (item.id === "notify") await client.desktop.notify({ title: "Product demo", body: "Command palette works." });
    if (item.id === "export") await client.files.exportJson("orders.json", [], { directory: "/tmp" });
    setPaletteOpen(false);
  }

  return (
    <>
      <DesktopLayout
        variant={demoProductTemplate.layout.appShell}
        brand={{ name: "Product Demo" }}
        menus={createMenus(screen)}
        user={{ name: session.user?.name ?? demoUser.name, role: session.user?.role ?? demoUser.role }}
        userMenuItems={[{ id: "audit", label: "审计日志", description: "需要 audit:read 权限", permission: "audit:read" }]}
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
        {screen === "orders" ? (
          <AccessGuard permission="orders:read" fallback={<AccessDeniedState />}>
            <Orders client={client} />
          </AccessGuard>
        ) : null}
        {screen === "settings" ? (
          <AccessGuard permission="settings:read" fallback={<AccessDeniedState />}>
            <Settings client={client} logs={logs} />
          </AccessGuard>
        ) : null}
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
      <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} appVersion="0.1.0" environment="product-demo" />
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
      locale="zh-CN"
      formatDefaults={{ currency: "USD", timeZone: "Asia/Shanghai" }}
      onMissingLocaleKey={(event) => {
        setLogs((current) => [`${new Date().toISOString()} i18n missing ${event.locale}:${event.key}`, ...current].slice(0, 10));
      }}
      accessControl={{
        features: {
          desktopNotify: true,
          updates: true,
          diagnostics: true,
          linkProxy: false,
          reviewWorkbench: false
        }
      }}
      session={{
        loadUser: async () => demoUser
      }}
    >
      <AuthGuard
        checkingFallback={<LoadingBlock rows={4} />}
        fallback={
          <DesktopLoginPage
            template={demoProductTemplate.layout.login}
            brand={{ name: "Product Demo" }}
            title="产品工作台登录"
            subtitle="输入任意账号密码即可进入，用来演示产品桌面端的登录与 session 流程。"
            visualTitle="Product workspace, product-owned business."
            visualDescription="底座提供壳、组件、主题、客户端和桌面能力；产品项目只维护业务页面。"
            submitLabel="进入工作台"
            login={{ login: loginDemoUser, defaultPayload: { account: "operator", password: "demo", remember: true } }}
          />
        }
      >
        <ProductWorkspace client={client} logs={logs} />
      </AuthGuard>
    </DesktopAppShell>
  );
}
