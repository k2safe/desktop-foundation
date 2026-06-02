import type { FormEvent, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface LoginShellBrand {
  name: string;
  logo?: ReactNode;
  mark?: ReactNode;
}

export type LoginShellVariant = "split" | "centered" | "workbench";

export interface LoginShellProps {
  brand: LoginShellBrand;
  title: ReactNode;
  variant?: LoginShellVariant;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  visualTitle?: ReactNode;
  visualDescription?: ReactNode;
  visual?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

export function LoginShell({
  brand,
  title,
  variant = "split",
  subtitle,
  badge,
  children,
  visualTitle,
  visualDescription,
  visual,
  footer,
  className,
  onSubmit
}: LoginShellProps) {
  const content = (
    <>
      <header className="df-login-shell__brand">
        {brand.logo ?? brand.mark ? <span className="df-login-shell__logo">{brand.logo ?? brand.mark}</span> : null}
        {!brand.logo ? <span className="df-login-shell__brand-name">{brand.name}</span> : null}
      </header>

      <div className="df-login-shell__content">
        <div className="df-login-shell__heading">
          {badge ? <div className="df-login-shell__badge">{badge}</div> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {children}
      </div>

      {footer ? <footer className="df-login-shell__footer">{footer}</footer> : null}
    </>
  );

  return (
    <main className={cn("df-login-shell", `df-login-shell--${variant}`, className)}>
      <section className="df-login-shell__panel">{onSubmit ? <form onSubmit={onSubmit}>{content}</form> : content}</section>
      <section className="df-login-shell__visual" aria-hidden={!visual && !visualTitle && !visualDescription}>
        {visual ?? (
          <div className="df-login-shell__visual-copy">
            {visualTitle ? <h2>{visualTitle}</h2> : null}
            {visualDescription ? <p>{visualDescription}</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
