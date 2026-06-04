import { useState } from "react";
import { useLocale } from "../../locale";

export interface CopyableTextProps {
  value: string;
  children?: string;
  copiedLabel?: string;
  copyLabel?: string;
  onCopy?: (value: string) => Promise<void> | void;
}

export function CopyableText({ value, children, copiedLabel, copyLabel, onCopy }: CopyableTextProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const resolvedCopiedLabel = copiedLabel ?? t("common.copied");
  const resolvedCopyLabel = copyLabel ?? t("common.copy");

  async function copy() {
    if (onCopy) {
      await onCopy(value);
    } else if (navigator?.clipboard) {
      await navigator.clipboard.writeText(value);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <span className="df-copyable">
      <span className="df-copyable__value">{children ?? value}</span>
      <button className="df-copyable__button" type="button" onClick={copy}>
        {copied ? resolvedCopiedLabel : resolvedCopyLabel}
      </button>
    </span>
  );
}
