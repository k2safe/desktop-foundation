import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, label, description, ...props }, ref) => (
  <label className={cn("df-switch", props.disabled && "is-disabled", className)}>
    <span className="df-switch__content">
      {label ? <span className="df-switch__label">{label}</span> : null}
      {description ? <span className="df-switch__description">{description}</span> : null}
    </span>
    <input ref={ref} className="df-switch__input" type="checkbox" role="switch" {...props} />
    <span className="df-switch__track" aria-hidden="true">
      <span className="df-switch__thumb" />
    </span>
  </label>
));

Switch.displayName = "Switch";
