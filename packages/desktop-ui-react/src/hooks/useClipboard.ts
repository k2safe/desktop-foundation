import { useCallback, useState } from "react";

export function useClipboard(resetAfterMs = 1200) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), resetAfterMs);
    },
    [resetAfterMs]
  );

  return { copied, copy };
}
