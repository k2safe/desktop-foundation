import type { DesktopCapability, NotifyOptions } from "./types";

export function createWebDesktopCapability(): DesktopCapability {
  return {
    openExternal: async (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    copyText: async (text: string) => {
      await navigator.clipboard.writeText(text);
    },
    notify: async ({ title, body }: NotifyOptions) => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    },
    getWindowState: async () => ({
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
      maximized: false,
      fullscreen: document.fullscreenElement !== null
    }),
    setWindowState: async () => undefined,
    setWindowTitle: async (title: string) => {
      document.title = title;
    }
  };
}
