import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "accent" | "primary" | "ghost" | "outline";

const variantClass: Record<ButtonVariant, string> = {
  accent: "btn btn--accent",
  primary: "btn btn--primary",
  ghost: "btn btn--ghost",
  outline: "btn btn--outline",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

/** Maps to Figma `Button` (Variant=Accent|Primary|Ghost|Outline). */
export function Button({
  variant = "accent",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(variantClass[variant], className)} {...rest}>
      {children}
    </button>
  );
}
