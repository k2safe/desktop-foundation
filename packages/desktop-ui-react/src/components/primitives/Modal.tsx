import type { ReactNode } from "react";
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

export function Modal({ open, title, description, children, footer, className, closeLabel = "关闭", onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div className="df-overlay" role="presentation">
      <div className={cn("df-modal", className)} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="df-modal__header">
          <div>
            {title ? <h2 className="df-modal__title">{title}</h2> : null}
            {description ? <p className="df-modal__description">{description}</p> : null}
          </div>
          <button className="df-close-button" type="button" onClick={onClose} aria-label={closeLabel}>
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
  confirmLabel = "确认",
  cancelLabel = "取消",
  confirming,
  tone = "primary",
  onClose,
  onConfirm,
  ...props
}: ConfirmDialogProps) {
  return (
    <Modal
      {...props}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={confirming} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="df-confirm-message">{message}</div>
    </Modal>
  );
}
