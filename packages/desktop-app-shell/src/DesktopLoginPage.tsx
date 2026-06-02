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
  title = "Sign in",
  subtitle,
  badge,
  variant,
  className,
  visualTitle,
  visualDescription,
  visual,
  footer,
  accountLabel = "Account",
  accountPlaceholder = "Account or email",
  passwordLabel = "Password",
  passwordPlaceholder = "Password",
  rememberLabel = "Remember me",
  submitLabel = "Sign in",
  extraFields,
  login
}: DesktopLoginPageProps<TUser, TPayload>) {
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
      title={title}
      variant={variant}
      subtitle={subtitle}
      badge={badge}
      className={className}
      visualTitle={visualTitle}
      visualDescription={visualDescription}
      visual={visual}
      footer={footer}
      onSubmit={handleSubmit}
    >
      <div className="df-login-form">
        {error ? <div className="df-login-form__error">{error.message}</div> : null}
        <Input
          autoFocus
          label={accountLabel}
          placeholder={accountPlaceholder}
          value={payload.account}
          onChange={(event) => setField("account", event.target.value as TPayload["account"])}
          required
        />
        <PasswordInput
          label={passwordLabel}
          placeholder={passwordPlaceholder}
          value={payload.password}
          onChange={(event) => setField("password", event.target.value as TPayload["password"])}
          required
        />
        {renderedExtraFields}
        <Checkbox
          label={rememberLabel}
          checked={Boolean(payload.remember)}
          onChange={(event) => setField("remember", event.target.checked as TPayload["remember"])}
        />
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </LoginShell>
  );
}
