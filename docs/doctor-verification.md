# Doctor Verification

Doctor onboarding is separated from patient registration. An authenticated user submits specialty, country/city, languages, legal identity and licensing information. The application is stored as UNDER_REVIEW and every review action is audited.

Lifecycle: PENDING -> UNDER_REVIEW -> VERIFIED, or REJECTED/SUSPENDED.

Public doctor search returns VERIFIED doctors only. Paid-service enforcement must also require VERIFIED status.

Remaining production controls: signed object-storage uploads for identity/license evidence, external licensing checks where lawful, sanctions/fraud screening, reviewer evidence, and jurisdiction-specific compliance.