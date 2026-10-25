# EA sync

## Important

MaddenHQ **does not store EA passwords**. Commissioners complete EA login in the browser, then paste the `http://127.0.0.1/...` callback URL. We exchange that for access/refresh tokens and encrypt them at rest.

EA Companion / Blaze APIs are **unofficial** and can change without notice. Treat production sync as experimental.

Protocol reference (MIT, Snallabot):  
https://github.com/snallabot/snallabot-service/blob/main/docs/madden/ea_api.md

## Modes

| `EA_CLIENT_MODE` | Behavior |
| --- | --- |
| `stub` (default) | Fixture-based client for local/dev and CI |
| `live` (alias: `experimental`) | Real Companion OAuth + Blaze exports |

## Commissioner flow

1. Open **League → Sync**
2. Click **Open EA login** (Companion-style MCA client)
3. After EA redirects to a blank `127.0.0.1` page, copy the full URL
4. Paste into MaddenHQ → choose persona (if more than one) → choose franchise league
5. **Run sync now** (or `npm run sync:stub -- <leagueId>`)

## Yearly constants

EA rotates Companion `client_id` / `client_secret` / Blaze product names each Madden title. Override via env:

```bash
EA_MADDEN_YEAR=2026
EA_MADDEN_TWO_DIGIT_YEAR=26
EA_CLIENT_ID=MCA_26_COMP_APP
EA_CLIENT_SECRET=...
EA_AUTH_SOURCE=317239
EA_MACHINE_KEY=444d362e8e067fe2
EA_REDIRECT_URL=http://127.0.0.1/success
EA_CLIENT_MODE=live
```

## Architecture

| Module | Role |
| --- | --- |
| `src/server/ea/auth.ts` | Code exchange, entitlements, personas, persona tokens, refresh |
| `src/server/ea/blaze.ts` | Legacy-SSL Blaze session, RPC, weekly exports |
| `src/server/ea/map-export.ts` | Blaze payloads → `EaWeekExport` |
| `src/server/ea/live-client.ts` | `EaClient` implementation for live mode |
| `src/server/ea/sync.ts` | Upsert into Postgres (locked per league) |

Blaze requires legacy SSL (`SSL_OP_LEGACY_SERVER_CONNECT`) against `wal2.tools.gos.bio-iad.ea.com`.

League list / hub RPC must use `componentName: "franchisemode"` (Companion). Using `careermode` returns `MCA_ERR_SERVER_ERROR` (67606).

Transient Blaze errors are retried with a fresh session. If listing still fails, Sync allows entering the numeric EA league id manually.

Connect wizard state (tokens, personas, league list) is stored in Postgres (`PendingEaConnect`) with only a short session id cookie. Encrypted EA JWTs are too large for browser cookies and would otherwise appear as “EA login session expired” on the next step.
