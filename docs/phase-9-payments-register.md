# Phase 9 - Payments, Balances, Dashboard, And Register

Phase 9 adds payment recording, reversal, derived invoice balances, dashboard metrics, invoice list filters, and CSV register export.

- `payments` and `payment_allocations` are append-only transaction tables.
- Posted payments update `invoices.paid_total`, `invoices.balance_due`, and derived invoice status.
- Payments cannot exceed invoice balance unless a future credit/overpayment policy is approved.
- Reversals preserve the original payment row and restore invoice balance/status transactionally.
- The Payments page records and reverses payments.
- The Dashboard now shows issued value, received value, outstanding balance, overdue count, recent invoices, and recent payments.
- The Invoices page supports search, status, currency, and date filters.
- `/api/reports/invoice-register` exports the filtered register as UTF-8 CSV with stable headers.

Use `npx prisma migrate deploy` on shared hosting after uploading this migration.
