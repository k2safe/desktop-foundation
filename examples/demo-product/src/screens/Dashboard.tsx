import { useState } from "react";
import { AdminPageShell, Button, ContentPanel, Select, useLocale } from "@desktop-foundation/ui-react";
import type { DesktopClient, HttpResponseMeta } from "@desktop-foundation/bridge";
import { themeTemplates, type ThemeTemplateId } from "@desktop-foundation/theme-presets";

export interface DashboardProps {
  client: DesktopClient;
  logs: string[];
  templateId: ThemeTemplateId;
  onTemplateChange: (templateId: ThemeTemplateId) => void;
  onOpenCommands: () => void;
}

interface LanguageRow {
  code: string;
  name: string;
}

interface LanguageResponse {
  rows?: LanguageRow[];
  source?: string;
}

export function Dashboard({ client, logs, templateId, onTemplateChange, onOpenCommands }: DashboardProps) {
  const { t } = useLocale();
  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [cacheMeta, setCacheMeta] = useState<HttpResponseMeta>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const languageOptions = [
    { value: "", label: t("product.i18n.noLanguage") },
    { value: "zh-CN", label: "简体中文 / zh-CN" },
    { value: "en-US", label: "English / en-US" }
  ];

  async function refreshLanguages() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const response = await client.http.get<LanguageResponse>("/demo-api/languages.json", {
        auth: false,
        cache: {
          key: "demo-product:languages",
          ttlMs: 60_000,
          storage: "persistent",
          staleIfError: true
        },
        onResponse: setCacheMeta
      });
      setLanguages(response.rows ?? []);
      await client.desktop.notify({ title: "Product Demo", body: "Language settings refreshed through foundation HTTP cache." });
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }

  const cache = cacheMeta?.cache;
  const cacheStatus = cache ? (cache.hit ? t("product.i18n.cacheHit") : t("product.i18n.cacheMiss")) : t("product.i18n.cacheIdle");
  const cacheStorage = cache?.storage ?? "-";
  const latestRequest = client.diagnostics.getRecentRequests()[0];

  return (
    <AdminPageShell
      title={t("product.dashboard.title")}
      description={t("product.dashboard.description")}
      actions={
        <Button variant="outline" loading={refreshing} onClick={() => void refreshLanguages()}>
          {t("product.i18n.refresh")}
        </Button>
      }
      className="demo-language-page"
    >
      <div className={`demo-alert ${refreshError ? "demo-alert--danger" : "demo-alert--info"}`}>
        {refreshError || t("product.i18n.error")}
      </div>
      <div className="demo-step-tabs" role="tablist" aria-label={t("product.dashboard.title")}>
        <button className="demo-step-tab is-active" type="button" role="tab" aria-selected="true">
          {t("product.i18n.tabLanguages")}
        </button>
        <button className="demo-step-tab" type="button" role="tab" aria-selected="false" onClick={onOpenCommands}>
          {t("product.i18n.tabTranslations")}
        </button>
      </div>
      <div className="demo-template-strip" aria-label={t("product.topbar.template")}>
        {themeTemplates.map((template) => (
          <button
            key={template.id}
            className={`demo-template-option ${template.id === templateId ? "is-active" : ""}`}
            type="button"
            aria-pressed={template.id === templateId}
            onClick={() => onTemplateChange(template.id as ThemeTemplateId)}
          >
            <span className="demo-template-swatches" aria-hidden="true">
              <i style={{ background: template.preview.primary }} />
              <i style={{ background: template.preview.chrome }} />
              <i style={{ background: template.preview.surface }} />
            </span>
            <span className="demo-template-name">{template.name}</span>
          </button>
        ))}
      </div>
      <ContentPanel
        className="demo-language-card"
        title={
          <span className="demo-panel-title">
            <span className="demo-panel-icon" aria-hidden="true">
              A
            </span>
            <span>{t("product.i18n.cardTitle")}</span>
          </span>
        }
        description={t("product.i18n.cardDescription")}
        actions={
          <Button variant="outline" size="sm" onClick={onOpenCommands}>
            {t("product.i18n.addLanguage")}
          </Button>
        }
      >
        <div className="demo-language-form">
          <label className="demo-language-field">
            <span>{t("product.i18n.systemDefault")}</span>
            <Select fullWidth={false} value="" options={languageOptions} />
          </label>
          <label className="demo-language-field">
            <span>{t("product.i18n.tenantLanguage")}</span>
            <Select fullWidth={false} value="" options={languageOptions} />
          </label>
        </div>
        <div className="demo-language-list">
          {languages.length ? (
            languages.map((language) => (
              <span key={language.code} className="demo-language-pill">
                <strong>{language.name}</strong>
                <small>{language.code}</small>
              </span>
            ))
          ) : (
            <span className="demo-language-placeholder">{t("product.i18n.noLanguage")}</span>
          )}
        </div>
        <div className="demo-cache-strip" aria-live="polite">
          <span>
            {t("product.i18n.cache")} <strong>{cacheStatus}</strong>
          </span>
          <span>
            {t("product.i18n.cacheStorage")} <strong>{cacheStorage}</strong>
          </span>
          <span>
            requestId <strong>{cacheMeta?.requestId ?? latestRequest?.requestId ?? "-"}</strong>
          </span>
        </div>
        <div className="demo-empty-language">{logs.length ? logs[0] : t("product.i18n.noLanguage")}</div>
      </ContentPanel>
      <div className="demo-page-actions">
        <Button onClick={() => void client.files.exportJson("language-settings.json", { locale: "demo" }, { directory: "/tmp" })}>{t("product.i18n.save")}</Button>
      </div>
    </AdminPageShell>
  );
}
