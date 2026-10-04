# Phase 5 — Payments + Commission Engine

Implemented:
- Stripe Connect Express onboarding for verified doctors.
- PaymentIntent creation only for a verified doctor with completed payout onboarding.
- Marketplace economics: patient pays consultation + patient fee; Stripe application fee captures patient + doctor platform fees; doctor destination transfer equals consultation minus doctor fee.
- Immutable per-transaction fee snapshot.
- Idempotent Stripe webhook event storage and signature verification with 5-minute tolerance.
- Successful payment confirms the appointment; failed payment cancels a pending appointment.
- Refund foundation with full/partial refund status tracking.
- Provider transaction IDs and client secrets are stored for traceability.
- Webhook payloads are retained for audit/replay workflows.
- Raw request body is enabled for Stripe signature verification.

Production follow-ups:
- Stripe Connect account.updated synchronization for onboarding completion.
- Dispute/chargeback event handling and payout reconciliation.
- Monthly doctor platform fee ledger/billing.
- Payment-method expansion (Apple Pay/Google Pay/local methods) and tax engine.
- Automated refund policy enforcement and admin refund approval.
- Queue-backed payment retries/reconciliation.
