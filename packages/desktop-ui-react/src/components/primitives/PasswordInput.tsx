import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "./Input";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showLabel = "显示", hideLabel = "隐藏", ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        suffix={
          <button className="df-password-toggle" type="button" onClick={() => setVisible((value) => !value)}>
            {visible ? hideLabel : showLabel}
          </button>
        }
      />
    );
  }
);

PasswordInput.displayName = "PasswordInput";
