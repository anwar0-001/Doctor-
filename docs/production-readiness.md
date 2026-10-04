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
- [x] Payment fee snapshots, Stripe webhook idempotency and Connect transfer reconciliation
- [x] Doctor earnings and payout ledger APIs with transfer identity separation
- [x] Monthly doctor fee ledger
- [x] Encrypted messaging and private medical documents
- [x] Security/financial unit tests
- [x] API readiness endpoint
- [x] CI API coverage command

## Required before a real launch
- [ ] Production Stripe account/connect configuration, live webhook registration and bank-payout reconciliation
- [x] Connected-account bank payout ledger, payout webhooks and admin reconciliation API
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

## Latest hardening
- Added persistent security-event telemetry for login failures, account lockouts, MFA failures, and refresh-token replay attempts.
- Medical document downloads are blocked in production until the document is explicitly marked CLEAN by the malware-scanning workflow.
- Security telemetry is best-effort and cannot convert an authentication failure into an application error.

## Financial reconciliation notes
- Destination-charge transfers are recorded as `providerTransferId` on `DoctorPayout`; `providerPayoutId` remains reserved for a future Stripe bank-payout ledger.
- `refund.updated` is reconciled against Stripe's cumulative `amount_refunded` instead of incrementing the local total, preventing duplicate-event overcounting.
- Doctor-facing earnings/payout endpoints never expose patient identity or medical data.

- Bank payouts from connected Stripe accounts are stored separately from platform-to-doctor destination transfers, preserving a clean two-stage financial ledger.
