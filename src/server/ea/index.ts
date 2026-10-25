import type { EaClient } from "./types";
import { StubEaClient } from "./stub-client";

export type { EaClient, EaTokens, EaWeekExport, EaLeagueSummary } from "./types";
export type { EaPersonaOption } from "./auth";
export { StubEaClient } from "./stub-client";
export { getEaLoginUrl } from "./constants";
export { extractAuthCode } from "./parse";

/**
 * Live client (and undici Blaze transport) are loaded only when EA_CLIENT_MODE=live
 * so stub/dashboard paths never pull Node-only undici into the module graph.
 */
export function getEaClient(): EaClient {
  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (mode === "live" || mode === "experimental") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LiveEaClient } = require("./live-client") as typeof import("./live-client");
    return new LiveEaClient();
  }
  return new StubEaClient();
}

export async function getLiveEaClient(): Promise<EaClient> {
  const { LiveEaClient } = await import("./live-client");
  return new LiveEaClient();
}
