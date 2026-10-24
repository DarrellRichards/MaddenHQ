import type { EaClient } from "./types";
import { StubEaClient } from "./stub-client";
import { ExperimentalEaClient } from "./experimental-client";

export type { EaClient, EaTokens, EaWeekExport, EaLeagueSummary } from "./types";
export { StubEaClient } from "./stub-client";
export { ExperimentalEaClient } from "./experimental-client";

export function getEaClient(): EaClient {
  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (mode === "experimental") {
    return new ExperimentalEaClient();
  }
  return new StubEaClient();
}
