import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: string;
  /** Accent border/text for validation or sync errors. */
  tone?: "default" | "alert";
};

/** Maps to Figma `Panel` — white surface with primary border. */
export function Panel({
  title,
  tone = "default",
  children,
  className,
  ...rest
}: PanelProps) {
  return (
    <section
      className={cn("panel", tone === "alert" && "panel--alert", className)}
      {...rest}
    >
      {title ? <h2 className="panel__title display">{title}</h2> : null}
      {children}
    </section>
  );
}
