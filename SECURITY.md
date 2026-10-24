# Security Policy

## Supported versions

The `main` branch is the supported line for security fixes during early development.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email the maintainers or use GitHub private vulnerability reporting on this repository.

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment (auth bypass, token leakage, etc.)

## Sensitive data notes

- Never commit `.env` files or live EA / Discord secrets
- EA access and refresh tokens must remain encrypted at rest (`EA_TOKEN_ENCRYPTION_KEY`)
- MaddenHQ must never store EA account passwords
