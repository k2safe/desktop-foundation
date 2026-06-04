import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useLocale } from "../../locale";
import { Input } from "./Input";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showLabel, hideLabel, ...props }, ref) => {
    const { t } = useLocale();
    const [visible, setVisible] = useState(false);
    const resolvedShowLabel = showLabel ?? t("common.show");
    const resolvedHideLabel = hideLabel ?? t("common.hide");

    return (
      <Input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        suffix={
          <button className="df-password-toggle" type="button" onClick={() => setVisible((value) => !value)}>
            {visible ? resolvedHideLabel : resolvedShowLabel}
          </button>
        }
      />
    );
  }
);

PasswordInput.displayName = "PasswordInput";
