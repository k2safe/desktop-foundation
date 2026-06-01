import { useCallback, useEffect, useState } from "react";
import { useDesktopClient } from "./DesktopClientProvider";
import type { WindowState } from "@desktop-foundation/bridge";

export function useWindowState() {
  const client = useDesktopClient();
  const [state, setState] = useState<WindowState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextState = await client.desktop.getWindowState();
      setState(nextState);
      setError(null);
      return nextState;
    } catch (caught) {
      const normalized = caught instanceof Error ? caught : new Error("Failed to read window state");
      setError(normalized);
      throw normalized;
    }
  }, [client]);

  const apply = useCallback(
    async (nextState: Partial<WindowState>) => {
      await client.desktop.setWindowState(nextState);
      await refresh();
    },
    [client, refresh]
  );

  const setTitle = useCallback((title: string) => client.desktop.setWindowTitle(title), [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    error,
    refresh,
    apply,
    setTitle
  };
}
