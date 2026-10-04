# DOCTOR

Global digital health platform foundation for patients, doctors, admins, appointments, secure messaging, video consultations, payments, subscriptions and health content.

## Phase 1 — Production Foundation
- Next.js + TypeScript web
- NestJS + TypeScript API
- PostgreSQL + Prisma
- Redis/queue-ready architecture
- S3-compatible private object storage
- Stripe Connect/video/notification provider adapters planned
- RBAC, ownership checks, audit logging and configurable country rules

See docs/architecture.md and docs/security.md.

## Current implementation status
Implemented in the production-foundation branch:
- Auth with Argon2id, MFA/TOTP, short-lived access tokens, refresh rotation/replay protection, session caps and login lockout.
- Doctor verification workflow and verified-only discovery/booking/payment gates.
- Time-zone aware availability, booking idempotency and double-booking protection.
- Stripe Connect payment intents, signed webhooks, webhook idempotency, cumulative refund reconciliation, destination-transfer reconciliation and immutable fee snapshots.
- Doctor earnings/payout ledgers with safe doctor-only financial views, destination-transfer reconciliation, connected-account bank-payout webhooks and admin reconciliation endpoints.
- Monthly doctor fee ledger using the configured monthly percentage and unique doctor/period/currency periods.
- RBAC, ownership checks, audit logging, encrypted messaging and private medical-document access controls.
- IDOR-focused tests across reviews, disputes, notifications, video sessions, messaging and authentication.

### Remaining external/production launch dependencies
The repository intentionally does not fake third-party infrastructure. Before a real launch, production credentials/configuration and integration work are still required for the selected video provider, email/SMS/push delivery, malware scanning, WAF/bot protection, managed secrets, backups/disaster recovery, observability, mobile apps, legal/privacy review, and a full staging/E2E/security/payment certification run.


### Latest security hardening
- Persistent security-event telemetry for authentication failures, account lockouts, MFA failures, and refresh-token replay.
- Medical documents have explicit malware-scan states; production downloads require a CLEAN result before a signed URL is issued.
