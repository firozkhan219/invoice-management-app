# Phase 1 Foundation

## Scope

This phase establishes the local SaaS foundation:

- Next.js App Router with TypeScript.
- MySQL/MariaDB Prisma schema for auth, organisations, memberships, invitations, audit logs, and file assets.
- Email/password registration and login service with bcrypt password hashing.
- Database-backed opaque sessions stored in secure HTTP-only cookies.
- Organisation onboarding that creates the first owner membership.
- Central role/permission matrix.
- Tenant-context repository boundary with tests proving cross-tenant isolation.

## Deployment Notes

HostingRaja smoke tests passed before this phase:

- Node.js v22.23.2.
- Environment variables.
- Persistent upload directory.
- MySQL connection.
- Pure Node PDF generation with PDFKit.

Use Next.js standalone output for deployment. Keep production secrets in the hosting panel environment-variable manager and never commit `.env` files.

## Migration Plan

Generate Prisma client locally:

```bash
npm run prisma:generate
```

Create a reviewed development migration only after confirming the target database is not production:

```bash
npm run prisma:migrate -- --name phase_1_foundation
```

Do not run production migrations without backup and explicit approval.

## Acceptance Checks

```bash
npm run typecheck
npm run test
npm run build
```

The Phase 1 tests cover central role permissions and repository-level tenant isolation. Later phases must add integration tests against the real database for every tenant-owned table.
