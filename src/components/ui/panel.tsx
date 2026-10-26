import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: string;
};

/** Maps to Figma `Panel` — white surface with primary border. */
export function Panel({ title, children, className, ...rest }: PanelProps) {
  return (
    <section className={cn("panel", className)} {...rest}>
      {title ? <h2 className="display text-primary text-lg m-0 mb-3">{title}</h2> : null}
      {children}
    </section>
  );
}
