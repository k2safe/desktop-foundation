import type { FormEvent, ReactNode } from "react";
import {
  Button,
  Checkbox,
  Input,
  LoginShell,
  PasswordInput,
  useLocale,
  type LocaleContextValue,
  type LoginShellVariant
} from "@desktop-foundation/ui-react";
import { useLogin } from "./useLogin";
import type { DesktopLoginConfig, DesktopLoginPayload, DesktopSessionUser } from "./types";

export interface DesktopLoginFieldContext<TPayload extends DesktopLoginPayload = DesktopLoginPayload> {
  payload: TPayload;
  setField: <K extends keyof TPayload>(key: K, value: TPayload[K]) => void;
  loading: boolean;
  error: Error | null;
}

export type DesktopLoginTemplateId = "split" | "brand-panel" | "center-card" | "workbench";

export interface DesktopLoginTemplate {
  id?: string;
  variant?: LoginShellVariant;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  visualTitle?: ReactNode;
  visualDescription?: ReactNode;
  visual?: ReactNode;
  footer?: ReactNode;
  accountLabel?: ReactNode;
  accountPlaceholder?: string;
  passwordLabel?: ReactNode;
  passwordPlaceholder?: string;
  rememberLabel?: ReactNode;
  submitLabel?: ReactNode;
}

export type DesktopLoginTemplateSource = DesktopLoginTemplateId | LoginShellVariant | DesktopLoginTemplate;

export const desktopLoginTemplates: Record<DesktopLoginTemplateId, DesktopLoginTemplate> = {
  split: {
    id: "split",
    variant: "split",
    title: "Sign in",
    subtitle: "Access the desktop workspace.",
    visualTitle: "Desktop-ready operations.",
    visualDescription: "A reusable shell for secure product workflows, local capabilities, and release updates."
  },
  "brand-panel": {
    id: "brand-panel",
    variant: "brand-split",
    title: "Sign in",
    subtitle: "Use your product account to continue.",
    badge: "Desktop",
    visualTitle: "One foundation, product-owned business.",
    visualDescription: "Keep brand, login copy, business fields, and authentication inside the product adapter."
  },
  "center-card": {
    id: "center-card",
    variant: "centered",
    title: "Welcome back",
    subtitle: "Sign in to continue.",
    submitLabel: "Continue"
  },
  workbench: {
    id: "workbench",
    variant: "workbench",
    title: "Operator sign in",
    subtitle: "Open the desktop command workspace.",
    badge: "Secure desktop",
    visualTitle: "Built for repeated operational work.",
    visualDescription: "Dense layouts, local bridge capabilities, update checks, and product-owned authentication."
  }
};

const loginShellVariants = new Set<LoginShellVariant>(["split", "centered", "workbench", "brand-split"]);

export function resolveDesktopLoginTemplate(template?: DesktopLoginTemplateSource): DesktopLoginTemplate {
  if (!template) return desktopLoginTemplates.split;
  if (typeof template !== "string") return template;
  if (template in desktopLoginTemplates) return desktopLoginTemplates[template as DesktopLoginTemplateId];
  if (loginShellVariants.has(template as LoginShellVariant)) return { id: template, variant: template as LoginShellVariant };
  return desktopLoginTemplates.split;
}

function mergeClassName(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ") || undefined;
}

function getLocalizedTemplateCopy(id: string | undefined, t: LocaleContextValue["t"]): Partial<DesktopLoginTemplate> {
  switch (id) {
    case "brand-panel":
      return {
        title: t("login.brandPanelTitle"),
        subtitle: t("login.brandPanelSubtitle"),
        badge: "Desktop",
        visualTitle: t("login.brandPanelVisualTitle"),
        visualDescription: t("login.brandPanelVisualDescription")
      };
    case "center-card":
      return {
        title: t("login.centerCardTitle"),
        subtitle: t("login.centerCardSubtitle"),
        submitLabel: t("login.continue")
      };
    case "workbench":
      return {
        title: t("login.workbenchTitle"),
        subtitle: t("login.workbenchSubtitle"),
        badge: t("login.secureDesktop"),
        visualTitle: t("login.workbenchVisualTitle"),
        visualDescription: t("login.workbenchVisualDescription")
      };
    case "split":
    default:
      return {
        title: t("login.splitTitle"),
        subtitle: t("login.splitSubtitle"),
        visualTitle: t("login.splitVisualTitle"),
        visualDescription: t("login.splitVisualDescription")
      };
  }
}

export interface DesktopLoginPageProps<
  TUser extends DesktopSessionUser = DesktopSessionUser,
  TPayload extends DesktopLoginPayload = DesktopLoginPayload
> {
  brand: {
    name: string;
    logo?: ReactNode;
    mark?: ReactNode;
  };
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  template?: DesktopLoginTemplateSource;
  variant?: LoginShellVariant;
  className?: string;
  visualTitle?: ReactNode;
  visualDescription?: ReactNode;
  visual?: ReactNode;
  footer?: ReactNode;
  accountLabel?: ReactNode;
  accountPlaceholder?: string;
  passwordLabel?: ReactNode;
  passwordPlaceholder?: string;
  rememberLabel?: ReactNode;
  submitLabel?: ReactNode;
  extraFields?: ReactNode | ((context: DesktopLoginFieldContext<TPayload>) => ReactNode);
  login: DesktopLoginConfig<TUser, TPayload>;
}

export function DesktopLoginPage<
  TUser extends DesktopSessionUser = DesktopSessionUser,
  TPayload extends DesktopLoginPayload = DesktopLoginPayload
>({
  brand,
  title,
  subtitle,
  badge,
  template,
  variant,
  className,
  visualTitle,
  visualDescription,
  visual,
  footer,
  accountLabel,
  accountPlaceholder,
  passwordLabel,
  passwordPlaceholder,
  rememberLabel,
  submitLabel,
  extraFields,
  login
}: DesktopLoginPageProps<TUser, TPayload>) {
  const { t } = useLocale();
  const resolvedTemplate = resolveDesktopLoginTemplate(template ?? variant);
  const localizedTemplate = typeof template === "string" || !template ? getLocalizedTemplateCopy(resolvedTemplate.id, t) : {};
  const resolvedVariant = variant ?? resolvedTemplate.variant;
  const resolvedTitle = title ?? localizedTemplate.title ?? resolvedTemplate.title ?? t("login.signIn");
  const resolvedSubtitle = subtitle ?? localizedTemplate.subtitle ?? resolvedTemplate.subtitle;
  const resolvedBadge = badge ?? localizedTemplate.badge ?? resolvedTemplate.badge;
  const resolvedVisualTitle = visualTitle ?? localizedTemplate.visualTitle ?? resolvedTemplate.visualTitle;
  const resolvedVisualDescription = visualDescription ?? localizedTemplate.visualDescription ?? resolvedTemplate.visualDescription;
  const resolvedVisual = visual ?? resolvedTemplate.visual;
  const resolvedFooter = footer ?? resolvedTemplate.footer;
  const resolvedAccountLabel = accountLabel ?? resolvedTemplate.accountLabel ?? t("login.account");
  const resolvedAccountPlaceholder = accountPlaceholder ?? resolvedTemplate.accountPlaceholder ?? t("login.accountPlaceholder");
  const resolvedPasswordLabel = passwordLabel ?? resolvedTemplate.passwordLabel ?? t("login.password");
  const resolvedPasswordPlaceholder = passwordPlaceholder ?? resolvedTemplate.passwordPlaceholder ?? t("login.passwordPlaceholder");
  const resolvedRememberLabel = rememberLabel ?? resolvedTemplate.rememberLabel ?? t("login.remember");
  const resolvedSubmitLabel = submitLabel ?? localizedTemplate.submitLabel ?? resolvedTemplate.submitLabel ?? t("login.signIn");
  const resolvedClassName = mergeClassName(resolvedTemplate.className, className);
  const { payload, setField, submit, loading, error } = useLogin(login);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  const renderedExtraFields =
    typeof extraFields === "function" ? extraFields({ payload, setField, loading, error }) : extraFields;

  return (
    <LoginShell
      brand={brand}
      title={resolvedTitle}
      variant={resolvedVariant}
      subtitle={resolvedSubtitle}
      badge={resolvedBadge}
      className={resolvedClassName}
      visualTitle={resolvedVisualTitle}
      visualDescription={resolvedVisualDescription}
      visual={resolvedVisual}
      footer={resolvedFooter}
      onSubmit={handleSubmit}
    >
      <div className="df-login-form">
        {error ? <div className="df-login-form__error">{error.message}</div> : null}
        <Input
          autoFocus
          label={resolvedAccountLabel}
          placeholder={resolvedAccountPlaceholder}
          value={payload.account}
          onChange={(event) => setField("account", event.target.value as TPayload["account"])}
          required
        />
        <PasswordInput
          label={resolvedPasswordLabel}
          placeholder={resolvedPasswordPlaceholder}
          value={payload.password}
          onChange={(event) => setField("password", event.target.value as TPayload["password"])}
          required
        />
        {renderedExtraFields}
        <Checkbox
          label={resolvedRememberLabel}
          checked={Boolean(payload.remember)}
          onChange={(event) => setField("remember", event.target.checked as TPayload["remember"])}
        />
        <Button type="submit" loading={loading}>
          {resolvedSubmitLabel}
        </Button>
      </div>
    </LoginShell>
  );
}
