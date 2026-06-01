import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, label, description, ...props }, ref) => (
  <label className={cn("df-check", props.disabled && "is-disabled", className)}>
    <input ref={ref} className="df-check__input" type="checkbox" {...props} />
    <span className="df-check__box" aria-hidden="true" />
    <span className="df-check__content">
      {label ? <span className="df-check__label">{label}</span> : null}
      {description ? <span className="df-check__description">{description}</span> : null}
    </span>
  </label>
));

Checkbox.displayName = "Checkbox";
