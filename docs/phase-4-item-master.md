# Phase 4 Units, Tax Rates, And Item Master

## Scope

This phase adds:

- Unit master with code, name, decimal precision, active/default flags.
- Tax-rate master with GST/export zero-rated/no-tax modes and decimal tax rate.
- Item master with SKU, name, description, HSN/SAC, unit, tax rate, sale rate, currency, and active status.
- Tenant-scoped item master services and form-post routes.
- Audit logging for unit, tax-rate, and item creation.
- Items page linked from the application sidebar.

## Tenant Rules

Every unit, tax rate, and item includes `organisation_id`. Browser input never supplies organisation scope. Services derive tenant context from the authenticated session and enforce `masters:read` or `masters:manage` through the central permission matrix.

When an item references a unit or tax rate, the service verifies the referenced record belongs to the same organisation before writing.

## Migration

Migration file:

```text
prisma/migrations/20260823000400_phase_4_item_master/migration.sql
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
