# MaddenHQ

Open-source headquarters for EA Sports Madden Connected Franchise leagues.

Track stats across leagues (per game, per player, year over year), sync from EA, grade trades with AI, and crown weekly + yearly awards — built for a community of commissioners and developers.

> Goal: outpace closed league sites and keep MaddenHQ extensible so other developers can ship features.

## Features (roadmap)

- Multi-league creation and membership
- EA token sync (no EA password storage)
- Per-game / per-player / YoY stats
- AI-assisted trade valuation
- Weekly Game of the Week (AI)
- Weekly AFC/NFC Offense & Defense Players of the Week (AI)
- Yearly league awards (AI)
- Donations via GitHub Sponsors + optional on-site Stripe link

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma
- Auth.js with **Discord** login (local/dev credentials for contributors)
- AWS-first deploy target (RDS + App Runner/ECS)

## Quick start

```bash
cp .env.example .env
docker compose up -d          # Postgres (+ Adminer on :8080)
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```

**Dev login:** `dev@maddenhq.local` / `maddenhq-dev`  
**Discord:** set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` for production-like auth.

## Onboarding flow

1. Sign in with Discord (or dev login)
2. Create a league
3. Open **Sync** → paste EA callback URL → run sync

## Docs

- [Architecture](docs/architecture.md)
- [EA sync](docs/ea-sync.md)
- [Brand](docs/brand.md)
- [AWS](docs/aws.md)
- [Contributing](CONTRIBUTING.md)

## Donate

MaddenHQ will stay free for leagues. Support hosting and AI features:

- [GitHub Sponsors](https://github.com/sponsors/DarrellRichards)
- On-site donations: set `STRIPE_DONATION_URL` and visit [`/donate`](http://localhost:3000/donate)

## License

[MIT](LICENSE)
