# Phase 3 Buyer And Address Master

## Scope

This phase adds:

- Buyer master data with display/legal names, contact person, email, phone, GSTIN, PAN, IEC, customer reference, notes, and active status.
- Multiple buyer addresses.
- Billing and consignee/shipping default flags.
- Country, state, state code, postcode, and contact details per address.
- Tenant-scoped buyer and address services.
- Audit logging for buyer and address creation.
- Buyers page and form-post routes.

## Tenant Rules

Every buyer and buyer address includes `organisation_id`. Browser input never supplies the organisation. Services derive tenant context from the authenticated user and enforce `masters:read` or `masters:manage` through the central permission matrix.

## Migration

Migration file:

```text
prisma/migrations/20260823000300_phase_3_buyer_address_master/migration.sql
```

HostingRaja/shared hosting deployment:

```bash
npx prisma migrate deploy
```

Do not use `prisma migrate dev` against HostingRaja because its database user cannot create Prisma shadow databases.

## Acceptance Checks

```bash
npm run prisma:generate
npm run typecheck
npm run test
npm run lint
npm run build
npm audit --audit-level=high
```
