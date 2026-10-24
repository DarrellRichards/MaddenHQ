# EA sync

## Important

MaddenHQ **does not store EA passwords**. Commissioners complete EA login in the browser, then paste the `http://127.0.0.1/...` callback URL. We exchange that for access/refresh tokens and encrypt them at rest.

EA Companion / Blaze APIs are **unofficial** and can change without notice. Treat production sync as experimental.

## Modes

| `EA_CLIENT_MODE` | Behavior |
| --- | --- |
| `stub` (default) | Fixture-based client for local/dev and CI |
| `experimental` | Placeholder for a real EA client (throws until implemented) |

## Flow

1. Commissioner opens **League → Sync**
2. Logs into EA (external)
3. Pastes callback URL into MaddenHQ
4. Tokens stored on `EaConnection` (encrypted)
5. **Run sync now** or `npm run sync:stub -- <leagueId>`

## Extending

Implement `EaClient` in `src/server/ea/` and switch `getEaClient()` via env. Keep the stub for contributors who cannot (or should not) hit EA.
