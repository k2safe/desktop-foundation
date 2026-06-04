import type { ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
  onClose: () => void;
}

export function Modal({ open, title, description, children, footer, className, closeLabel, onClose }: ModalProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <div className={cn("df-modal", className)} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="df-modal__header">
          <div>
            {title ? <h2 className="df-modal__title">{title}</h2> : null}
            {description ? <p className="df-modal__description">{description}</p> : null}
          </div>
          <button className="df-close-button" type="button" onClick={onClose} aria-label={closeLabel ?? t("modal.close")}>
            ×
          </button>
        </div>
        <div className="df-modal__body">{children}</div>
        {footer ? <div className="df-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps extends Omit<ModalProps, "children" | "footer"> {
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  tone?: "primary" | "danger";
  onConfirm: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel,
  confirming,
  tone = "primary",
  onClose,
  onConfirm,
  ...props
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel");

  return (
    <Modal
      {...props}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {resolvedCancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={confirming} onClick={onConfirm}>
            {resolvedConfirmLabel}
          </Button>
        </>
      }
    >
      <div className="df-confirm-message">{message}</div>
    </Modal>
  );
}
