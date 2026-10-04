# Doctor Architecture

## Runtime
Web (Next.js) -> WAF/API Gateway -> NestJS API -> PostgreSQL + Redis + queue + private object storage.
External services are isolated behind adapters: Stripe Connect for marketplace payments/payouts; Daily/Twilio/Agora for video; FCM/APNs/email/SMS for notifications.

## Domains
Identity/RBAC, Patient, Doctor Verification, Search, Scheduling, Appointments, Messaging, Video, Documents, Payments/Ledger, Payouts, Subscriptions, Ads, Reviews, Disputes, Content, Notifications, Audit/Security.

## Roles
PATIENT, DOCTOR, MODERATOR, SUPPORT, FINANCE, ADMIN, SUPER_ADMIN.

## Financial correctness
A Commission Engine resolves effective fees by country, currency, service and plan. Each transaction stores an immutable fee/tax/processing snapshot, so later admin changes never rewrite history.

## Scalability
Stateless API instances, indexed PostgreSQL, Redis caching, background queues, CDN/private object storage, idempotent provider webhooks and horizontal scaling.

## Compliance
GDPR/HIPAA/local medical and payment rules are deployment-specific. The platform therefore uses configurable consent, retention, verification and regional policy controls; legal/privacy review is required before launch in each market.