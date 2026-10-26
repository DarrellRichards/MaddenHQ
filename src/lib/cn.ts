/** Tiny className joiner — prefer Tailwind utilities; keep legacy CSS classes when needed. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
