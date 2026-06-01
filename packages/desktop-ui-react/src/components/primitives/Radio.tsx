import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(({ className, label, description, ...props }, ref) => (
  <label className={cn("df-radio", props.disabled && "is-disabled", className)}>
    <input ref={ref} className="df-radio__input" type="radio" {...props} />
    <span className="df-radio__dot" aria-hidden="true" />
    <span className="df-radio__content">
      {label ? <span className="df-radio__label">{label}</span> : null}
      {description ? <span className="df-radio__description">{description}</span> : null}
    </span>
  </label>
));

Radio.displayName = "Radio";

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value?: string;
  options: RadioOption[];
  direction?: "row" | "column";
  className?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({ name, value, options, direction = "row", className, onValueChange }: RadioGroupProps) {
  return (
    <div className={cn("df-radio-group", `df-radio-group--${direction}`, className)} role="radiogroup">
      {options.map((option) => (
        <Radio
          key={option.value}
          name={name}
          value={option.value}
          checked={value === option.value}
          disabled={option.disabled}
          label={option.label}
          description={option.description}
          onChange={() => onValueChange?.(option.value)}
        />
      ))}
    </div>
  );
}
