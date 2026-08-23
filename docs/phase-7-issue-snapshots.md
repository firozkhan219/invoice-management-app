# Phase 7 Issue, Snapshots, And Auditability

## Scope

This phase adds:

- Issue action for draft invoices.
- Atomic invoice-number allocation from an invoice number series.
- Issued invoice metadata: number, sequence, financial year, issuer, issued timestamp.
- Immutable JSON snapshots for company, buyer, consignee/address, bank, calculation, and document state.
- Invoice revision records.
- Generated document records with template version placeholders.
- Cancel action for issued invoices with reason and cancellation metadata.
- Audit logs for issue and cancellation.

## Boundary

This phase does not render the final production invoice PDF or send email. `generated_documents` records are created as durable document metadata placeholders for Phase 8 PDF generation.

## Migration

Migration file:

```text
prisma/migrations/20260823000700_phase_7_issue_snapshots/migration.sql
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
