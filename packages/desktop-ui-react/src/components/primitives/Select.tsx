import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  options: SelectOption[];
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, placeholder, options, fullWidth = true, id, ...props }, ref) => {
    const describedBy = id && error ? `${id}-error` : id && hint ? `${id}-hint` : undefined;

    return (
      <label className={cn("df-field", fullWidth && "df-field--full")}>
        {label ? <span className="df-field__label">{label}</span> : null}
        <span className={cn("df-select-wrap", Boolean(error) && "is-invalid", props.disabled && "is-disabled")}>
          <select
            ref={ref}
            id={id}
            className={cn("df-select", className)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled={props.required}>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
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

Select.displayName = "Select";
