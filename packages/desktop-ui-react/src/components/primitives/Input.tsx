import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, prefix, suffix, fullWidth = true, id, ...props }, ref) => {
    const describedBy = id && error ? `${id}-error` : id && hint ? `${id}-hint` : undefined;

    return (
      <label className={cn("df-field", fullWidth && "df-field--full")}>
        {label ? <span className="df-field__label">{label}</span> : null}
        <span className={cn("df-input-wrap", Boolean(error) && "is-invalid", props.disabled && "is-disabled")}>
          {prefix ? <span className="df-input__addon">{prefix}</span> : null}
          <input ref={ref} id={id} className={cn("df-input", className)} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
          {suffix ? <span className="df-input__addon">{suffix}</span> : null}
        </span>
        {error ? (
          <span id={id ? `${id}-error` : undefined} className="df-field__error">
            {error}
          </span>
        ) : hint ? (
          <span id={id ? `${id}-hint` : undefined} className="df-field__hint">
            {hint}
          </span>
        ) : null}
      </label>
    );
  }
);

Input.displayName = "Input";
