# DOCTOR Security Baseline

Phase 2 establishes the identity and access-control foundation.

- Passwords are hashed with Argon2id.
- Access tokens are short-lived JWTs (15 minutes) and contain no health data.
- Refresh tokens are high-entropy opaque values stored only as SHA-256 hashes and rotated on use.
- Refresh sessions are revocable and capped per account.
- MFA uses TOTP; the secret is encrypted at rest with AES-256-GCM using a server-side key.
- Roles are checked server-side from the database on each authenticated request.
- DTO validation rejects unknown fields.
- Helmet provides secure HTTP headers.
- API documentation is exposed through OpenAPI/Swagger.
- Throttling is enabled globally; sensitive auth endpoints will receive stricter limits as the auth edge matures.

Important production controls still required before launch: email/phone verification delivery, password reset, CSRF strategy for browser cookies, distributed rate limiting, WAF/bot protection, security event telemetry, device/session management UI, backup codes/WebAuthn, audit logging of all sensitive auth actions, secret rotation, and automated security testing.