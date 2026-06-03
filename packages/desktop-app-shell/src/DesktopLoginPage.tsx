import type { FormEvent, ReactNode } from "react";
import { Button, Checkbox, Input, LoginShell, PasswordInput, type LoginShellVariant } from "@desktop-foundation/ui-react";
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
  const resolvedTemplate = resolveDesktopLoginTemplate(template ?? variant);
  const resolvedVariant = variant ?? resolvedTemplate.variant;
  const resolvedTitle = title ?? resolvedTemplate.title ?? "Sign in";
  const resolvedSubtitle = subtitle ?? resolvedTemplate.subtitle;
  const resolvedBadge = badge ?? resolvedTemplate.badge;
  const resolvedVisualTitle = visualTitle ?? resolvedTemplate.visualTitle;
  const resolvedVisualDescription = visualDescription ?? resolvedTemplate.visualDescription;
  const resolvedVisual = visual ?? resolvedTemplate.visual;
  const resolvedFooter = footer ?? resolvedTemplate.footer;
  const resolvedAccountLabel = accountLabel ?? resolvedTemplate.accountLabel ?? "Account";
  const resolvedAccountPlaceholder = accountPlaceholder ?? resolvedTemplate.accountPlaceholder ?? "Account or email";
  const resolvedPasswordLabel = passwordLabel ?? resolvedTemplate.passwordLabel ?? "Password";
  const resolvedPasswordPlaceholder = passwordPlaceholder ?? resolvedTemplate.passwordPlaceholder ?? "Password";
  const resolvedRememberLabel = rememberLabel ?? resolvedTemplate.rememberLabel ?? "Remember me";
  const resolvedSubmitLabel = submitLabel ?? resolvedTemplate.submitLabel ?? "Sign in";
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
