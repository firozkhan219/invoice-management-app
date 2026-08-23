# Phase 6 Invoice Drafts And Calculation Engine

## Scope

This phase adds:

- Draft invoice and invoice line-item tables.
- Invoice list, new draft screen, and draft editor.
- Server-side decimal calculation engine for taxable amounts, IGST, CGST, SGST, round-off, and grand total.
- Draft create/update routes.
- Add-line route with total recalculation.
- Optimistic version field and stale-edit checks.
- Tenant-scoped invoice services and referenced-record validation.

## Boundary

This phase intentionally does not issue invoices, allocate real invoice numbers during draft creation, create immutable snapshots, render production PDFs, record payments, or send email. Those are later phases.

## Migration

Migration file:

```text
prisma/migrations/20260823000600_phase_6_invoice_drafts/migration.sql
```

HostingRaja/shared hosting deployment:

```bash
npx prisma migrate deploy
```

## Acceptance Checks

```bash
npm run prisma:generate
npm run typecheck
npm run test
npm run lint
npm run build
npm audit --audit-level=high
```
