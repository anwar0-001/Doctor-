# Security Baseline

- TLS/HSTS and secure headers in production.
- Argon2id password hashing; short-lived access tokens and rotating refresh tokens.
- MFA and step-up authentication for privileged/sensitive actions.
- RBAC plus resource ownership checks on every protected resource.
- Strict request validation, parameterized ORM queries, rate limiting and abuse controls.
- No secrets in clients or Git; use a production secret manager.
- Signed, idempotent payment/provider webhooks with replay protection.
- Private encrypted object storage and time-limited download URLs.
- Immutable audit logs for verification, refunds, payouts, pricing and admin actions.
- Least privilege for DB/storage/service accounts and encrypted backups.
- Server-side verification of Play Integrity/App Attest signals.
- Defense in depth; no security control is described as impossible to bypass.