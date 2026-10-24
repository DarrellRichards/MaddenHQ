# Contributing to MaddenHQ

Thanks for helping build the open-source Madden league platform.

## Quick start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Dev login (when Discord OAuth is not configured): `dev@maddenhq.local` / `maddenhq-dev`.

## Project map

| Area | Path |
| --- | --- |
| UI (App Router) | `src/app/` |
| Auth | `src/auth.ts` |
| EA sync adapter | `src/server/ea/` |
| Trade AI stub | `src/server/trades/` |
| Awards AI stubs | `src/server/awards/` |
| Prisma schema | `prisma/schema.prisma` |

Prefer adding features inside these module folders so other developers can extend one concern at a time.

## Checks before a PR

```bash
npm run lint
npm run typecheck
npm test
```

## Auth model

- **Discord** = site identity
- **EA connect** = league data sync (commissioners only; never store EA passwords)

## Design

See [docs/brand.md](docs/brand.md). Keep the white / `#4B5F91` / `#D32F2F` palette and logo-first marketing surfaces.
