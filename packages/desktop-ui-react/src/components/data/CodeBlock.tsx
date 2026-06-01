import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface CodeBlockProps {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
}

export function CodeBlock({ children, title, className }: CodeBlockProps) {
  return (
    <figure className={cn("df-code-block", className)}>
      {title ? <figcaption>{title}</figcaption> : null}
      <pre>
        <code>{children}</code>
      </pre>
    </figure>
  );
}
