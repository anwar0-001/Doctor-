# Production Readiness Checklist

## Implemented in repository
- [x] NestJS API + Prisma/PostgreSQL
- [x] Global validation, Helmet, CORS allowlist, request IDs
- [x] RBAC and ownership checks
- [x] Argon2id + MFA/TOTP
- [x] Refresh rotation and replay protection
- [x] Login lockout state
- [x] Doctor verification and verified-only discovery
- [x] Availability and booking idempotency
- [x] Payment fee snapshots and Stripe webhook idempotency
- [x] Monthly doctor fee ledger
- [x] Encrypted messaging and private medical documents
- [x] Security/financial unit tests
- [x] API readiness endpoint
- [x] CI API coverage command

## Required before a real launch
- [ ] Production Stripe account/connect configuration and reconciliation
- [ ] Real video provider with signed short-lived room tokens
- [ ] Push/email/SMS providers and delivery workers
- [~] Uploads are explicitly marked pending-scan; external malware scanner/quarantine worker remains required
- [ ] Managed secrets/KMS and key rotation
- [ ] Redis-backed distributed throttling and queue workers
- [ ] WAF, bot/fraud controls, SIEM/security-event pipeline
- [ ] Managed PostgreSQL backups, restore drills and disaster recovery
- [ ] Error tracking, metrics, tracing, alerting and SLOs
- [~] Security unit coverage exists; full staging E2E, payment, authz, IDOR/BOLA and load testing remain required
- [ ] Mobile apps with App Attest/Play Integrity and secure storage
- [ ] Legal/privacy review for GDPR, HIPAA applicability and local medical rules
- [ ] Clinical safety review for AI/content and prescription workflows
- [ ] Production deployment with migrations, rollback and smoke tests
