# Phase 10 - Security And Release Hardening

Phase 10 adds final release hardening without changing the product layout.

## Implemented

- Added Next 16 `proxy.ts` API boundary checks.
- Blocks cross-origin browser POST requests to API routes.
- Adds in-memory rate limiting for login, registration, PDF, CSV, and API routes.
- Adds security headers:
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - Content Security Policy
- Expanded `.env.example` with deployment notes.
- Added focused tests for request guards.

## Residual Production Notes

- The in-memory rate limiter is suitable as first-layer protection for a single persistent HostingRaja Node process. If the app later runs multiple processes or servers, replace it with a database or Redis-backed limiter.
- Email verification, password reset, invitations, and SMTP are still future hardening work before allowing unrelated external customers.
- Take a database backup before every production migration.
- Keep `uploads/` and generated documents out of public web roots.
