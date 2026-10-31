# MaddenHQ Design System

Figma (DaddyLeague League Site): [MaddenHQ Design System](https://www.figma.com/design/Jfpf56LxiRODZaO5v8gwtj)

Marketing landing frame: [Landing / Desktop](https://www.figma.com/design/Jfpf56LxiRODZaO5v8gwtj?node-id=5-13) → implemented by `src/app/page.tsx`.

Code tokens live in `src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). React primitives: `src/components/ui/`.

## Token map (Figma → CSS)

| Figma variable | CSS / Tailwind |
| --- | --- |
| `color/background` | `--background` / `bg-background` |
| `color/foreground` | `--foreground` / `text-foreground` |
| `color/primary` | `--primary` / `bg-primary` `text-primary` |
| `color/primary-soft` | `--primary-soft` / `bg-primary-soft` |
| `color/primary-border` | `--primary-border` / `border-primary-border` |
| `color/accent` | `--accent` / `bg-accent` `text-accent` |
| `color/accent-hover` | `--accent-hover` |
| `color/muted` | `--muted` (`#6B7280`) / `text-muted` |
| `color/ink-dark` | `--ink-dark` / `bg-ink-dark` |
| `color/surface` | `--surface` / `bg-surface` |
| `color/on-accent` | `--on-accent` |
| `color/on-primary` | `--on-primary` |
| `color/nav-foreground` | `--nav-foreground` |
| `spacing/1` … `spacing/8` | `--spacing-1` … `--spacing-8` |
| `radius/none` | `--radius` (0 — sharp sport chrome) |

Primitives (`brand/500`, `accent/500`, …) alias into the semantic Color collection. Do not hardcode hex outside `globals.css` / brand docs.

## Typography

| Role | Font | Figma text style |
| --- | --- | --- |
| Display / labels | Chakra Petch Bold | `Display/H1`, `Display/H2`, `Display/Label` |
| Body | Manrope | `Body/Regular`, `Body/Strong` |

Loaded in `src/app/layout.tsx` as `--font-display` / `--font-body`.

## Components

| Figma | Code |
| --- | --- |
| `Button` (`Variant=Accent\|Primary\|Ghost\|Outline`) | `<Button variant="…">` + `.btn` / `.btn--*` |
| `Panel` | `<Panel title tone?>` + `.panel` / `.panel--alert` / `.panel__title` / `.panel__toolbar` |

Legacy class names remain so existing pages keep working while we migrate to the UI package.

## Brand invariants

Background `#FFFFFF`, primary `#4B5F91`, accent `#D32F2F`. See [brand.md](./brand.md).
