import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface FormFieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, description, error, required, children, className }: FormFieldProps) {
  return (
    <div className={cn("df-form-field", className)}>
      {label || description ? (
        <div className="df-form-field__header">
          {label ? (
            <div className="df-form-field__label">
              {label}
              {required ? <span className="df-form-field__required">*</span> : null}
            </div>
          ) : null}
          {description ? <div className="df-form-field__description">{description}</div> : null}
        </div>
      ) : null}
      <div className="df-form-field__control">{children}</div>
      {error ? <div className="df-form-field__error">{error}</div> : null}
    </div>
  );
}
