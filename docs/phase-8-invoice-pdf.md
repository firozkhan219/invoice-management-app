# Phase 8 - Invoice PDF

Phase 8 adds issued-invoice PDF generation and browser preview.

- Generates an A4 invoice PDF with `pdfkit`.
- Uses the issued invoice snapshots for company, buyer, address, bank, and calculation data.
- Exposes a protected `/api/invoices/[id]/pdf` route for authenticated users with document download permission.
- Stores generated PDFs under `UPLOAD_DIR/generated-documents/{organisationId}/{invoiceId}`.
- Records generated document metadata and audit logs.
- Adds an `Open PDF` action to issued invoice detail pages.

No database migration is required because Phase 7 already created the generated document fields.
