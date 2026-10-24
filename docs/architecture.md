# Architecture

```text
Discord login → create/join League → Connect EA → Sync worker → Postgres
                                         ↓
                              stats / trades / awards UI
```

## Stack

- **Next.js App Router** UI + route handlers
- **Auth.js** Discord OAuth (+ local credentials for contributors)
- **PostgreSQL + Prisma** multi-league domain model
- **EA adapter** (`src/server/ea`) with stub + experimental clients
- **AWS target**: App Runner (or ECS) + RDS Postgres + Secrets Manager

## Modules

| Module | Responsibility |
| --- | --- |
| `src/server/ea` | Token exchange, refresh, week/all export, upsert into Prisma |
| `src/server/trades` | Trade evaluation AI interface |
| `src/server/awards` | Weekly + season award suggestion interfaces |
| `src/app/leagues/[slug]` | League-scoped UI tabs |

## Data highlights

- `PlayerGameStat.stats` is JSON so Madden export fields can evolve without constant migrations.
- Indexes favor leaderboards and week-scoped awards: season/week, player/season, league/award/week.
