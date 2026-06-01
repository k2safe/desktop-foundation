import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => (
    <label className="df-field df-field--full">
      {label ? <span className="df-field__label">{label}</span> : null}
      <textarea ref={ref} id={id} className={cn("df-textarea", Boolean(error) && "is-invalid", className)} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="df-field__error">{error}</span> : hint ? <span className="df-field__hint">{hint}</span> : null}
    </label>
  )
);

Textarea.displayName = "Textarea";
