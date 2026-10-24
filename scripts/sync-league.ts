#!/usr/bin/env tsx
/**
 * CLI entry for league sync (cron / ECS scheduled task later).
 *
 * Usage:
 *   npm run sync:stub -- <leagueId>
 */
import { syncLeagueFromEa } from "../src/server/ea/sync";

async function main() {
  const leagueId = process.argv[2];
  if (!leagueId) {
    console.error("Usage: npm run sync:stub -- <leagueId>");
    process.exit(1);
  }

  const result = await syncLeagueFromEa(leagueId);
  console.log(`Synced ${result.weeks} week export(s) for league ${leagueId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
