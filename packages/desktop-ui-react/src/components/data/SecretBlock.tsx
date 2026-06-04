import { useState } from "react";
import { useLocale } from "../../locale";

export interface SecretBlockProps {
  value: string;
  mask?: string;
  revealLabel?: string;
  hideLabel?: string;
}

export function SecretBlock({ value, mask = "••••••••••••", revealLabel, hideLabel }: SecretBlockProps) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const resolvedRevealLabel = revealLabel ?? t("common.show");
  const resolvedHideLabel = hideLabel ?? t("common.hide");

  return (
    <span className="df-secret">
      <code>{visible ? value : mask}</code>
      <button className="df-secret__button" type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? resolvedHideLabel : resolvedRevealLabel}
      </button>
    </span>
  );
}
