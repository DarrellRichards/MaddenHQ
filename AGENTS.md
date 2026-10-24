# Agent / contributor notes

MaddenHQ is modular on purpose so humans and coding agents can add features without rewriting the core.

## Invariants

1. Multi-league tenancy: every domain row hangs off `League`.
2. Discord (or local/dev credentials) authenticates people; EA credentials authenticate data sync.
3. EA client code lives behind `src/server/ea` (`EaClient` interface). Prefer the stub client in tests.
4. AI features (trades, weekly awards, season awards) are service stubs first — swap implementations without changing UI contracts.
5. Brand tokens are fixed: background `#FFFFFF`, primary `#4B5F91`, accent `#D32F2F`.

## Useful commands

```bash
npm run dev
npm run db:migrate
npm run db:seed
npm run sync:stub -- <leagueId>
npm run lint && npm run typecheck && npm test
```
