import { ConfirmProvider, LocaleProvider, ThemeProvider, ToastProvider } from "@desktop-foundation/ui-react";
import { DesktopAccessProvider } from "./DesktopAccessProvider";
import { DesktopClientProvider } from "./DesktopClientProvider";
import { SessionProvider } from "./SessionProvider";
import type { DesktopAppShellProps, DesktopSessionUser } from "./types";

export function DesktopAppShell<TUser extends DesktopSessionUser = DesktopSessionUser>({
  theme,
  className,
  locale,
  messages,
  dictionaries,
  accessControl,
  client,
  session,
  children
}: DesktopAppShellProps<TUser>) {
  return (
    <ThemeProvider theme={theme} className={className}>
      <LocaleProvider locale={locale} messages={messages} dictionaries={dictionaries}>
        <ToastProvider>
          <ConfirmProvider>
            <DesktopClientProvider client={client}>
              <SessionProvider config={session}>
                <DesktopAccessProvider accessControl={accessControl}>{children}</DesktopAccessProvider>
              </SessionProvider>
            </DesktopClientProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
