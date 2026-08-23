# Phase 5 Settings, Locked Periods, And Number Series

## Scope

This phase adds:

- Organisation-level invoice settings.
- Default company and default bank account references.
- Default invoice title, tax mode, rounding policy, declaration, notes, terms, PDF footer, page-number and autosave flags.
- Manual invoice number/date override controls.
- Locked accounting periods.
- Invoice number series with `{PREFIX}`, `{FY}`, `{YYYY}`, `{YY}`, `{SEQ}`, and `{SEQ:n}` tokens.
- Series reset rules: never, calendar year, financial year.
- Atomic invoice-number allocation service for later issue flow.
- Settings page linked from the application sidebar.

## Tenant Rules

Settings, locked periods, invoice number series, and voided numbers are organisation-scoped. Browser input never supplies `organisationId`. Server services derive tenant context from the authenticated session and enforce central permissions.

## Migration

Migration file:

```text
prisma/migrations/20260823000500_phase_5_settings_number_series/migration.sql
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
