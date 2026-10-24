# AWS deployment (target)

MaddenHQ is AWS-first. This pass documents the intended shape; it does **not** provision production resources.

## Recommended shape

| Piece | Service |
| --- | --- |
| Web app | AWS App Runner or ECS Fargate |
| Database | RDS PostgreSQL (`db.t4g.micro` to start) or Aurora Postgres Serverless v2 (low ACU) |
| Secrets | Secrets Manager (`DATABASE_URL`, `NEXTAUTH_SECRET`, Discord, `EA_TOKEN_ENCRYPTION_KEY`) |
| Sync job | EventBridge + ECS task / App Runner job calling `scripts/sync-league.ts` |

## Cost notes

- Early open-source traffic usually favors a small Postgres instance over DynamoDB for this relational sports model.
- Keep AI award/trade calls on-demand; cache weekly results in Postgres.
- Use a single region close to your community.

## Infra stubs

See [`infra/aws/`](../infra/aws/) for placeholder variables. Do not `apply` until secrets and networking are intentionally configured.
