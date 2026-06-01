import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface FormRowProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormRow({ children, columns = 2, className }: FormRowProps) {
  return <div className={cn("df-form-row", `df-form-row--${columns}`, className)}>{children}</div>;
}
