import type { Metadata } from "next";
import { Button, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Design system",
};

const colorTokens = [
  ["primary", "var(--primary)"],
  ["accent", "var(--accent)"],
  ["background", "var(--background)"],
  ["foreground", "var(--foreground)"],
  ["primary-soft", "var(--primary-soft)"],
  ["ink-dark", "var(--ink-dark)"],
  ["muted", "var(--muted)"],
  ["surface", "var(--surface)"],
] as const;

export default function DesignSystemPage() {
  return (
    <div className="shell stack">
      <header className="stack stack--tight">
        <p className="page-kicker">MaddenHQ · Foundations</p>
        <h1 className="display page-title">Design system</h1>
        <p className="muted prose-narrow">
          Live token check against the Figma library on DaddyLeague League Site. Prefer{" "}
          <code>src/components/ui</code> and CSS variables from <code>globals.css</code>.
        </p>
      </header>

      <Panel title="Colors">
        <div className="swatch-grid">
          {colorTokens.map(([name, value]) => (
            <div key={name} className="swatch">
              <div
                className="swatch__chip"
                aria-hidden
                style={{ background: value }}
              />
              <span className="display swatch__label">{name}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="button-row">
          <Button variant="accent">Accent</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <span className="ghost-stage">
            <Button variant="ghost">Ghost</Button>
          </span>
        </div>
      </Panel>

      <Panel title="Typography">
        <p className="display panel__title display-lg">Display · Chakra Petch</p>
        <p className="prose-narrow">
          Body · Manrope. League copy stays readable; display faces carry the sport chrome.
        </p>
      </Panel>
    </div>
  );
}
