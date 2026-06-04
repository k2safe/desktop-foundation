import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface ToastMessage {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
}

export interface ToastContextValue {
  toasts: ToastMessage[];
  notify: (toast: Omit<ToastMessage, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((toast: Omit<ToastMessage, "id"> & { id?: string }) => {
    const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((items) => [...items, { ...toast, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toasts, notify, dismiss }), [dismiss, notify, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  const { t } = useLocale();
  if (!toasts.length) return null;

  return (
    <div className="df-toast-viewport" role="region" aria-label={t("toast.region")}>
      {toasts.map((toast) => (
        <div key={toast.id} className={cn("df-toast", `df-toast--${toast.tone ?? "neutral"}`)} role="status">
          <div className="df-toast__body">
            <div className="df-toast__title">{toast.title}</div>
            {toast.description ? <div className="df-toast__description">{toast.description}</div> : null}
          </div>
          <button className="df-close-button" type="button" onClick={() => onDismiss(toast.id)} aria-label={t("toast.close")}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
