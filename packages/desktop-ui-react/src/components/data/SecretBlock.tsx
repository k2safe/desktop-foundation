import { useState } from "react";

export interface SecretBlockProps {
  value: string;
  mask?: string;
  revealLabel?: string;
  hideLabel?: string;
}

export function SecretBlock({ value, mask = "••••••••••••", revealLabel = "显示", hideLabel = "隐藏" }: SecretBlockProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="df-secret">
      <code>{visible ? value : mask}</code>
      <button className="df-secret__button" type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? hideLabel : revealLabel}
      </button>
    </span>
  );
}
