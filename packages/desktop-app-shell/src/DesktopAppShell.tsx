import { ConfirmProvider, ThemeProvider, ToastProvider } from "@desktop-foundation/ui-react";
import { DesktopClientProvider } from "./DesktopClientProvider";
import { SessionProvider } from "./SessionProvider";
import type { DesktopAppShellProps, DesktopSessionUser } from "./types";

export function DesktopAppShell<TUser extends DesktopSessionUser = DesktopSessionUser>({
  theme,
  client,
  session,
  children
}: DesktopAppShellProps<TUser>) {
  return (
    <ThemeProvider theme={theme}>
      <ToastProvider>
        <ConfirmProvider>
          <DesktopClientProvider client={client}>
            <SessionProvider config={session}>{children}</SessionProvider>
          </DesktopClientProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
