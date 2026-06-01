import { cn } from "../../utils/cn";
import { CopyableText } from "./CopyableText";

export interface AddressTextProps {
  value: string;
  head?: number;
  tail?: number;
  copyable?: boolean;
  className?: string;
}

function middleEllipsis(value: string, head: number, tail: number) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function AddressText({ value, head = 8, tail = 6, copyable, className }: AddressTextProps) {
  const display = middleEllipsis(value, head, tail);

  if (copyable) {
    return (
      <span className={cn("df-address", className)} title={value}>
        <CopyableText value={value}>{display}</CopyableText>
      </span>
    );
  }

  return (
    <span className={cn("df-address", className)} title={value}>
      {display}
    </span>
  );
}
