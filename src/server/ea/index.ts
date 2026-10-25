import type { EaClient } from "./types";
import { StubEaClient } from "./stub-client";
import { LiveEaClient } from "./live-client";

export type { EaClient, EaTokens, EaWeekExport, EaLeagueSummary } from "./types";
export type { EaPersonaOption } from "./auth";
export { StubEaClient } from "./stub-client";
export { LiveEaClient } from "./live-client";
export { getEaLoginUrl } from "./constants";
export { extractAuthCode } from "./parse";

export function getEaClient(): EaClient {
  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (mode === "live" || mode === "experimental") {
    return new LiveEaClient();
  }
  return new StubEaClient();
}
