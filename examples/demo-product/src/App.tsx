import "@desktop-foundation/ui-react/styles.css";
import "./demo.css";
import { useEffect, useMemo, useState } from "react";
import { AccessDeniedState, AccessGuard, AuthGuard, DebugPanel, DesktopAppShell, DesktopLoginPage, useSession } from "@desktop-foundation/app-shell";
import {
  CommandPalette,
  DesktopLayout,
  IconButton,
  LoadingBlock,
  SearchInput,
  useLocale,
  type CommandPaletteItem,
  type DesktopMenuItem,
  type LocaleCode
} from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { createThemeTemplateRuntime, themeTemplates, type ThemeTemplateId } from "@desktop-foundation/theme-presets";
import { createRuntimeDemoProductClient, loginDemoUser } from "./client";
import { createMenus, demoUser, type DemoScreen } from "./data";
import { productDictionaries } from "./i18n";
import { Dashboard } from "./screens/Dashboard";
import { Orders } from "./screens/Orders";
import { Settings } from "./screens/Settings";

function isTauriRuntime() {
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function DemoLogoMark() {
  return (
    <span className="demo-brand-mark">
      <img src="/brand/foundation-demo-logo.png" alt="" />
    </span>
  );
}

function TranslationIcon() {
  return (
    <svg className="demo-line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5h7" />
      <path d="M9 3v2" />
      <path d="M4 9c3.1 0 5.7-1.5 7-4" />
      <path d="M7.1 8.5c.8 1 1.8 1.8 3 2.4" />
      <path d="M15 13h4.2" />
      <path d="M14 20l3.1-8h.9l3 8" />
      <path d="M15 17h5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="demo-line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M18.4 9.2A7.2 7.2 0 0 0 6 7.7L4 10" />
      <path d="M5.6 14.8A7.2 7.2 0 0 0 18 16.3l2-2.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="demo-line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8" />
      <path d="M10 21h4" />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg className="demo-line-icon demo-line-icon--command" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 8h8v8H8z" />
      <path d="M8 8H6.5A2.5 2.5 0 1 1 9 5.5V8" />
      <path d="M16 8V5.5A2.5 2.5 0 1 1 18.5 8H16" />
      <path d="M16 16h2.5A2.5 2.5 0 1 1 16 18.5V16" />
      <path d="M8 16v2.5A2.5 2.5 0 1 1 5.5 16H8" />
    </svg>
  );
}

interface ProductWorkspaceProps {
  client: DesktopClient;
  logs: string[];
  templateId: ThemeTemplateId;
  locale: LocaleCode;
  onTemplateChange: (templateId: ThemeTemplateId) => void;
  onLocaleChange: (locale: LocaleCode) => void;
}

function ProductWorkspace({ client, logs, templateId, locale, onTemplateChange, onLocaleChange }: ProductWorkspaceProps) {
  const { t } = useLocale();
  const session = useSession();
  const [screen, setScreen] = useState<DemoScreen>("dashboard");
  const [debugOpen, setDebugOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteValue, setPaletteValue] = useState("");

  const commands: CommandPaletteItem[] = [
    { id: "dashboard", label: t("product.command.dashboard"), group: t("product.command.group.nav") },
    { id: "orders", label: t("product.command.orders"), group: t("product.command.group.nav"), permission: "orders:read" },
    { id: "settings", label: t("product.command.settings"), group: t("product.command.group.nav"), permission: "settings:read" },
    { id: "notify", label: t("product.command.notify"), group: t("product.command.group.desktop"), feature: "desktopNotify" },
    { id: "export", label: t("product.command.export"), group: t("product.command.group.file"), permission: "orders:export" },
    { id: "debug", label: t("product.topbar.debug"), group: t("product.command.group.desktop"), feature: "diagnostics" },
    { id: "review", label: t("product.command.review"), group: t("product.command.group.experiment"), feature: "reviewWorkbench" }
  ];

  function handleMenuSelect(item: DesktopMenuItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") {
      setScreen(item.id);
    }
    if (item.id === "deposit" || item.id === "withdraw" || item.id === "wallet") {
      setScreen("orders");
    }
    if (item.id === "admins" || item.id === "roles" || item.id === "menus" || item.id === "audit" || item.id === "api" || item.id === "release" || item.id === "storage") {
      setScreen("settings");
    }
  }

  async function handleCommand(item: CommandPaletteItem) {
    if (item.id === "dashboard" || item.id === "orders" || item.id === "settings") setScreen(item.id);
    if (item.id === "notify") await client.desktop.notify({ title: "Product demo", body: "Command palette works." });
    if (item.id === "export") await client.files.exportJson("orders.json", [], { directory: "/tmp" });
    if (item.id === "debug") setDebugOpen(true);
    setPaletteOpen(false);
  }

  async function handleRefresh() {
    client.diagnostics.recordAuditEvent({ action: "workspace.refresh", ok: true, message: "Demo workspace refreshed" });
    await client.desktop.notify({ title: "Foundation Demo", body: "Workspace refreshed." });
  }

  return (
    <>
      <DesktopLayout
        variant="sidebar"
        className="demo-admin-layout"
        brand={{ name: t("product.brand"), mark: <DemoLogoMark /> }}
        menus={createMenus(screen, t)}
        user={{ name: t("product.user.name"), role: t("product.user.role"), account: session.user?.account ?? demoUser.account }}
        userMenuItems={[{ id: "audit", label: "Audit log", description: "audit:read", permission: "audit:read" }]}
        showUserMeta
        topbarLeft={
          <div className="demo-global-search-wrap">
            <SearchInput className="demo-global-search" placeholder={t("product.topbar.search")} />
          </div>
        }
        topbarRight={
          <div className="demo-topbar-toolbar">
            <div className="demo-topbar-icon-rail">
              <IconButton
                className="demo-topbar-icon demo-topbar-icon--language"
                size="sm"
                variant="ghost"
                label={t("product.topbar.languageToggle")}
                data-locale-badge={locale === "zh-CN" ? "JA" : "中"}
                icon={<TranslationIcon />}
                onClick={() => onLocaleChange(locale === "zh-CN" ? "en-US" : "zh-CN")}
              />
              <IconButton className="demo-topbar-icon" size="sm" variant="ghost" label={t("product.topbar.refresh")} icon={<RefreshIcon />} onClick={() => void handleRefresh()} />
              <IconButton
                className="demo-topbar-icon demo-topbar-icon--notify"
                size="sm"
                variant="ghost"
                label={t("product.topbar.notify")}
                icon={<BellIcon />}
                onClick={() => void client.desktop.notify({ title: "Product Demo", body: "Desktop notification is routed through foundation." })}
              />
              <IconButton className="demo-topbar-icon demo-topbar-icon--command" size="sm" variant="ghost" label={t("product.topbar.commands")} icon={<CommandIcon />} onClick={() => setPaletteOpen(true)} />
            </div>
          </div>
        }
        footer={
          <div className="demo-sidebar-footer">
            <div>
              <span>API</span>
              <strong>Online</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>v0.1.36</strong>
            </div>
          </div>
        }
        onMenuSelect={handleMenuSelect}
        onLogout={session.clearSession}
      >
        {screen === "dashboard" ? (
          <Dashboard
            client={client}
            logs={logs}
            templateId={templateId}
            onTemplateChange={onTemplateChange}
            onOpenCommands={() => setPaletteOpen(true)}
          />
        ) : null}
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
        title={t("command.title")}
        placeholder={t("command.search")}
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
  const [client, setClient] = useState<DesktopClient | null>(null);
  const [templateId, setTemplateId] = useState<ThemeTemplateId>("ops-admin");
  const [locale, setLocale] = useState<LocaleCode>("zh-CN");
  const [desktopRuntime] = useState(isTauriRuntime);
  const template = useMemo(() => createThemeTemplateRuntime(templateId, { brand: { name: "Product Demo" } }), [templateId]);

  useEffect(() => {
    let mounted = true;
    void createRuntimeDemoProductClient((value) => {
      setLogs((current) => [`${new Date().toISOString()} ${value}`, ...current].slice(0, 10));
    }).then((nextClient) => {
      if (mounted) setClient(nextClient);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!client) {
    return (
      <div className="df-demo-product df-demo-product__boot">
        <LoadingBlock rows={4} />
      </div>
    );
  }

  return (
    <DesktopAppShell
      theme={template.theme}
      className={`${template.className} df-demo-product ${desktopRuntime ? "df-demo-product--desktop" : "df-demo-product--web"}`}
      client={client}
      locale={locale}
      dictionaries={productDictionaries}
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
            template={template.layout.login}
            brand={{ name: "Product Demo" }}
            title={productDictionaries[locale]?.["product.login.title"]}
            subtitle={productDictionaries[locale]?.["product.login.subtitle"]}
            visualTitle={productDictionaries[locale]?.["product.login.visualTitle"]}
            visualDescription={productDictionaries[locale]?.["product.login.visualDescription"]}
            submitLabel={productDictionaries[locale]?.["product.login.submit"]}
            login={{ login: loginDemoUser, defaultPayload: { account: "operator", password: "demo", remember: true } }}
          />
        }
      >
        <ProductWorkspace client={client} logs={logs} templateId={templateId} locale={locale} onTemplateChange={setTemplateId} onLocaleChange={setLocale} />
      </AuthGuard>
    </DesktopAppShell>
  );
}
