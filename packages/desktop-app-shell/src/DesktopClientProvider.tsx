import { createDesktopClient, type DesktopClient, type DesktopClientConfig } from "@desktop-foundation/bridge";
import { createContext, useContext, useMemo, type ReactNode } from "react";

const DesktopClientContext = createContext<DesktopClient | null>(null);

function isDesktopClient(value: DesktopClient | DesktopClientConfig): value is DesktopClient {
  return "http" in value && "session" in value && "storage" in value;
}

export interface DesktopClientProviderProps {
  client: DesktopClient | DesktopClientConfig;
  children: ReactNode;
}

export function DesktopClientProvider({ client, children }: DesktopClientProviderProps) {
  const desktopClient = useMemo(() => (isDesktopClient(client) ? client : createDesktopClient(client)), [client]);

  return <DesktopClientContext.Provider value={desktopClient}>{children}</DesktopClientContext.Provider>;
}

export function useDesktopClient() {
  const client = useContext(DesktopClientContext);
  if (!client) {
    throw new Error("useDesktopClient must be used inside DesktopClientProvider");
  }
  return client;
}
