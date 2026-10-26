import type { Metadata } from "next";
import { Button, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Design system",
};

export default function DesignSystemPage() {
  return (
    <div className="shell stack">
      <header className="stack" style={{ gap: "0.5rem" }}>
        <p className="muted" style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 700 }}>
          MaddenHQ · Foundations
        </p>
        <h1 className="display" style={{ margin: 0 }}>
          Design system
        </h1>
        <p className="muted" style={{ margin: 0, maxWidth: "52ch" }}>
          Live token check against the Figma library on DaddyLeague League Site. Prefer{" "}
          <code>src/components/ui</code> and CSS variables from <code>globals.css</code>.
        </p>
      </header>

      <Panel title="Colors">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "1rem",
          }}
        >
          {[
            ["primary", "var(--primary)"],
            ["accent", "var(--accent)"],
            ["background", "var(--background)"],
            ["foreground", "var(--foreground)"],
            ["primary-soft", "var(--primary-soft)"],
            ["ink-dark", "var(--ink-dark)"],
            ["muted", "var(--muted)"],
            ["surface", "var(--surface)"],
          ].map(([name, value]) => (
            <div key={name} className="stack" style={{ gap: "0.4rem" }}>
              <div
                aria-hidden
                style={{
                  height: 72,
                  background: value,
                  border: "1px solid var(--primary-border)",
                }}
              />
              <span className="display" style={{ fontSize: "0.7rem", color: "var(--primary)" }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Buttons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Button variant="accent">Accent</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <span style={{ background: "var(--ink-dark)", padding: "0.5rem" }}>
            <Button variant="ghost">Ghost</Button>
          </span>
        </div>
      </Panel>

      <Panel title="Typography">
        <h2 className="display text-primary" style={{ marginTop: 0 }}>
          Display · Chakra Petch
        </h2>
        <p style={{ margin: 0, maxWidth: "48ch" }}>
          Body · Manrope. League copy stays readable; display faces carry the sport chrome.
        </p>
      </Panel>
    </div>
  );
}
