# Codex Master Prompt: Online Invoice Management SaaS

## Your role

You are a senior SaaS product architect, full-stack TypeScript engineer, database architect, security reviewer, QA engineer, and deployment engineer.

Build a production-quality, multi-tenant online invoice management SaaS for Indian businesses and exporters. The application will be hosted initially on HostingRaja at:

- Production URL: `https://app.decorativehandicraft.com`
- Hosting type: HostingRaja account with Node.js support and a hosting control panel/cPanel-style deployment

Work incrementally. Keep the application runnable after every phase. Do not invent material business rules. When a decision affects taxation, invoice numbering, data integrity, hosting compatibility, or security, explain the options and ask before implementing the affected feature.

The supplied invoice PDF is the visual and field reference. It is not a source of hard-coded customer, company, bank, item, tax, or signature data.

---

## Mandatory first response: audit and planning only

Before changing code, inspect the repository and attachments and return:

1. Existing-project audit: framework, dependencies, implemented features, migrations, tests, branches, uncommitted changes, and reusable code.
2. Hosting compatibility checklist and the exact information still required from HostingRaja.
3. Recommended architecture, with any alternative that may be required by the hosting limits.
4. Assumptions and a short list of blocking questions only.
5. Database ERD and migration plan.
6. Folder structure.
7. Phased implementation plan, acceptance criteria, and deployment plan.

Do not implement all phases in the first response. Do not replace working code merely to match this prompt; propose a safe migration when the repository already contains useful work.

---

## Phase 0: hosting and repository preflight

Complete and document this preflight before choosing deployment-sensitive libraries:

- Confirm the hosting panel type and whether it provides “Setup Node.js App” or an equivalent application manager.
- Record supported Node.js versions and choose the newest active LTS version available.
- Confirm whether a persistent Node.js process is supported and how it is restarted.
- Confirm the application startup-file requirement, environment-variable support, SSH access, Git deployment support, build-command support, memory/CPU/process limits, request timeout, and writable persistent directories.
- Confirm whether MariaDB/MySQL is provided, its version, database size/connection limits, remote access policy, backup method, and SSL settings.
- Check whether PostgreSQL is actually available. Do not assume that it is.
- Check whether the host permits Chromium/Puppeteer. Run a minimal PDF proof-of-concept. If it is unavailable or unreliable, use a pure Node PDF implementation and retain a visually equivalent browser preview.
- Confirm cron-job availability for maintenance, expired sessions, document cleanup, and backups.
- Confirm SMTP details or an external transactional-email option.
- Confirm SSL for `app.decorativehandicraft.com`, DNS requirements, and whether the subdomain document root can be kept separate from the main website.
- Confirm maximum upload size and backup/restore access.
- Produce a small deployment smoke test before building major modules: health route, database connection, environment variables, one protected route, persistent upload test, and PDF test.

If the hosting plan cannot safely run the selected application, stop and provide evidence plus the smallest viable hosting alternative. Do not redesign the entire product around an unsupported assumption.

---

## Technology and deployment baseline

Use this baseline unless Phase 0 proves that a component is unsupported:

- Next.js App Router with TypeScript
- Node.js runtime; do not use Edge-only APIs
- Next.js standalone production output or the startup method required by the hosting panel
- Tailwind CSS and shadcn/ui
- MariaDB/MySQL with Prisma ORM and SQL migrations
- Auth.js or an equally secure server-side authentication solution compatible with a persistent Node.js server
- Email/password authentication using Argon2id or bcrypt with an appropriate work factor
- Database-backed sessions with secure, HTTP-only, SameSite cookies
- React Hook Form and Zod
- Server Actions and/or secure Route Handlers for mutations
- Decimal.js plus database `DECIMAL` columns for money and quantity calculations
- Vitest for unit/integration tests and Playwright for end-to-end browser tests
- ESLint and Prettier
- Server-generated PDF: first test Puppeteer/Chromium; if unsupported, use a pure Node engine such as PDFKit with embedded fonts
- SMTP or a transactional email service for verification and password reset

Do not add Supabase, Firebase, Vercel-only services, serverless-only assumptions, offline mode, Electron, SQLite, local synchronisation, or a mobile application unless I explicitly approve a change.

Abstract database, file storage, email, and PDF generation behind service interfaces so they can be migrated later without rewriting business logic.

---

## Product objective and MVP boundary

Create a secure online SaaS where a user can:

- register and verify an account;
- create or join an organisation/workspace;
- invite users and assign roles;
- maintain companies, bank accounts, buyers, addresses, items, taxes, units, and numbering series;
- create, preview, issue, download, print, email, amend, cancel, and duplicate invoices;
- record payments and view outstanding balances;
- export an invoice register to CSV;
- retain immutable issued-invoice snapshots and a complete audit trail.

MVP does not include inventory, purchase orders, e-invoicing/IRN, e-way bills, GST return filing, accounting-software synchronisation, mobile apps, or payment-gateway billing. Create clean extension points but no empty screens or placeholder integrations.

This product may later become a paid SaaS. Include organisation plan/status fields and feature-limit hooks, but do not implement a payment gateway until separately approved.

---

## Multi-tenancy, roles, and permissions

Every tenant-owned record must contain `organisation_id`. Never accept an organisation ID from the browser as proof of access; derive and verify membership on the server.

Roles:

- Owner: full access, ownership transfer, billing/plan visibility, organisation deletion/export.
- Admin: manage operational settings, masters, users, invoices, and reports; cannot transfer ownership.
- Accountant: create/edit/issue invoices, record payments, and view reports according to permissions.
- Viewer: read-only access and PDF/CSV downloads if enabled.

Implement a central permission matrix. Do not scatter ad hoc role checks across UI components. Enforce permissions in server-side services and database queries; hiding a button is not security.

All tenant queries and writes must include authorised `organisation_id` scoping. Add integration tests proving cross-tenant isolation. Where the chosen database does not support PostgreSQL-style RLS, enforce tenant isolation through a mandatory repository/data-access layer, compound indexes/constraints, transaction checks, code-review guards, and automated isolation tests. Never claim MySQL/MariaDB provides Supabase-style RLS.

---

## Security and privacy requirements

- Never expose database passwords, SMTP secrets, application secrets, or service credentials in browser bundles.
- Keep `.env*` files, customer exports, uploaded signatures, database dumps, and production documents out of Git.
- Provide `.env.example` with names and descriptions only.
- Validate all input with Zod at the server boundary and normalise data before persistence.
- Protect state-changing requests against CSRF according to the authentication approach.
- Rate-limit login, registration, password reset, invitations, PDF generation, CSV export, and email endpoints.
- Use secure password reset tokens: random, hashed at rest, single-use, and expiring.
- Require email verification before access to production data.
- Add secure headers and a Content Security Policy compatible with the app.
- Restrict uploads by MIME type, extension, byte signature, and size; generate safe filenames; prevent path traversal and public directory listing.
- Store signatures, logos, PDFs, and exports outside a directly browsable public path. Serve them only after an authorisation check or by a short-lived signed mechanism.
- Do not log secrets, full session tokens, passwords, private bank account data, or document contents.
- Record security-relevant events in the audit log.
- Add dependency audit and production security review in the final phase.

---

## Core navigation

- Dashboard
- Invoices
- Payments
- Buyers
- Items
- Companies
- Reports
- Users & Roles
- Settings

Use a desktop-first responsive application shell that also works on tablets and mobile. Include accessible navigation, loading states, empty states, error states, permission-aware actions, and confirmation for destructive operations.

---

## Organisation settings

Support:

- Organisation name, locale, time zone, default currency, and date format
- Financial-year start month; default April
- Default company and bank account
- Default invoice title
- Default tax mode: automatic, IGST, CGST+SGST, zero-rated/export, or no tax
- Tax calculation and rounding policy
- Default declaration, notes, payment terms, and delivery terms
- PDF footer and optional page numbers
- Draft autosave preference
- Number-on-issue as the default; optional number-on-draft only after explicit confirmation
- Locked accounting periods
- Permission controlling manual invoice-number/date overrides
- Retention and download settings

### Invoice number-series builder

Support tokens:

- `{PREFIX}`
- `{FY}`
- `{YYYY}`
- `{YY}`
- `{SEQ}` and padded variants such as `{SEQ:4}`

Examples: `INV/{FY}/{SEQ:4}`, `DH/{YYYY}/{SEQ:5}`, `{SEQ:2}`.

Each series needs company scope where applicable, prefix, separator, padding, starting number, next sequence, and reset rule: never, calendar year, or financial year. Show a non-binding preview. Allocate the real number only inside the issue transaction.

---

## Company and bank-account master

Allow multiple legal entities within one organisation.

Company fields:

- Legal name and trading name
- Address lines, city, state, state code, postcode, country
- Phone/mobile and email
- GSTIN, PAN, IEC/exporter reference, and optional tax identifiers
- Logo
- Authorised signatory name, designation, and signature image
- Default declaration and terms
- Invoice number-series default
- Active/inactive

Bank-account fields:

- Bank name
- Account holder/company name
- Masked account number in ordinary screens; full value only for authorised use and invoice rendering
- IFSC
- SWIFT/BIC
- Branch code, branch name, and branch address
- Currency
- Default flag and active/inactive

Encrypt sensitive bank fields at application level if supported by the final key-management/deployment design. Do not apply irreversible hashing to values that must appear on invoices.

---

## Buyer and address master

Buyer fields:

- Company/buyer name and contact person
- Buyer type: domestic or export
- Mobile/phone and email
- GSTIN or foreign tax registration
- Default currency
- Payment terms and delivery terms/Incoterm
- Credit period in days
- Active/inactive and internal notes

Support multiple labelled addresses per buyer:

- Billing/buyer
- Consignee/shipping
- Other

Address fields: recipient/company, attention/contact, address lines, city, state, state code, postcode, country, phone, email, and tax registration. Provide “same as buyer” when creating an invoice, but save the final invoice-specific snapshots independently.

---

## Item, unit, and tax master

Item fields:

- Item number/SKU, unique within the organisation
- Item name and invoice description
- HSN/SAC code
- Material, dimensions/size, finish
- Unit of measure
- Default selling rate and currency
- Default GST rate/tax category
- Product image, not shown on the supplied invoice template unless enabled in a future template
- Active/inactive

Support configurable units and tax rates. Do not hard-code only “Pcs.” or 5% GST.

---

## Invoice workflow and states

Use an explicit state machine:

- Draft
- Issued
- Partially Paid
- Paid
- Cancelled
- Amended/Superseded

Define legal transitions and permissions centrally. Payment-derived states must be calculated from valid payment allocations, not freely selected from a dropdown.

### Create/edit invoice

1. Choose company/legal entity, number series, and bank account.
2. Select buyer and consignee. Copy master data into editable draft fields.
3. Set invoice date, due date, buyer order number/date, exporter reference, currency, and exchange-rate notes where required.
4. Set place of supply and supply/tax treatment.
5. Enter logistics fields:
   - pre-carriage by;
   - place of receipt by pre-carrier;
   - vessel/flight number;
   - port of loading;
   - port of discharge;
   - port of final destination;
   - country of origin;
   - country of final destination;
   - delivery/payment terms;
   - marks and numbers;
   - container number.
6. Add, remove, duplicate, and drag/reorder line items.
7. Selecting an item fills SKU, description, HSN/SAC, unit, rate, and GST rate, while the draft values remain editable.
8. Line fields: item/SKU, description, HSN/SAC, quantity, unit, rate, line discount, taxable amount, GST rate, IGST, CGST, SGST, and line total.
9. Support invoice discount, other charges, round-off, notes, declaration, and terms.
10. Recalculate live for user feedback, but independently validate and calculate on the server for every save and issue.
11. Safely autosave drafts with visible saving/saved/error state and optimistic-concurrency protection. Never overwrite a newer edit silently.
12. Save draft without consuming the final number by default.
13. On issue, atomically validate, allocate the number, create immutable snapshots, write the audit event, and create or queue the PDF record.
14. Actions: preview, issue, duplicate, print, download PDF, email, record payment, amend, and cancel.

Issued invoices are immutable. An amendment must preserve the original document, store a reason, create a linked revision/superseding invoice or formal revision according to the approved policy, and never silently rewrite history.

---

## Invoice numbering, date, and concurrency rules

- Generate the next sequence atomically inside a database transaction using a locked series row or an equivalent proven approach.
- Use an isolation level and retry strategy appropriate for MariaDB/MySQL deadlocks.
- Enforce uniqueness with a database constraint that includes `organisation_id`, `series_id`, and `invoice_number`.
- Treat “next invoice number” previews as non-binding.
- Do not reuse cancelled, amended, or failed-after-allocation invoice numbers. Record void numbers when necessary.
- Owner/Admin may manually override a number or date only with permission and a mandatory reason.
- Validate manual numbers against format, uniqueness, financial-year, and locked-period rules.
- Store original value, new value, reason, acting user, IP/user-agent where appropriate, and timestamp in revision/audit records.
- Use the organisation time zone when deriving financial year, but store timestamps in UTC.

---

## GST, currency, totals, and rounding

Use database `DECIMAL`, Prisma Decimal, and Decimal.js. Never use JavaScript floating-point arithmetic for financial values.

Default calculation policy for MVP, unless I approve a change:

- Round each taxable line amount and each line tax component to 2 decimal places using commercial half-up rounding.
- `taxable line amount = quantity × rate - line discount`
- `subtotal = sum(taxable line amounts)`
- `grand total = subtotal + taxes + other charges - invoice discount + round-off`
- Derive round-off explicitly and store it; do not hide balancing differences.

Tax determination:

- Domestic intrastate supply: CGST and SGST split equally.
- Domestic interstate supply: IGST.
- Export/zero-rated/no-tax: calculate according to the selected approved treatment.
- Place of supply must be explicit and validated; do not infer solely from an incomplete address.
- Permit an authorised manual tax-mode override only with a mandatory reason and audit event.

Show subtotal, discount, other charges, IGST, CGST, SGST, round-off, grand total, paid amount, and balance due where appropriate.

Generate amount in words from the stored final total and currency, including paise/cents when non-zero. Support Indian numbering for INR, for example: “One Lakh Thirty-Six Thousand Eighty Rupees Only.” Add tested behaviour for INR and a safe international fallback for other currencies.

The editor, server, database, PDF, CSV, and tests must use the same calculation service and rounding policy.

---

## Payments

Allow authorised users to record payments against an issued invoice:

- payment date;
- amount and currency;
- payment method;
- transaction/reference number;
- bank account;
- notes;
- created by/at;
- reversal status and reversal reason.

Do not delete posted payments. Reverse them with an audit trail. Prevent allocated payment totals from exceeding the invoice balance unless an explicit overpayment/credit policy is later approved. Derive Partially Paid and Paid status transactionally.

---

## Reference A4 invoice template

Reproduce the supplied one-page A4 portrait “Tax Invoice” closely, while improving legibility and correcting obvious source typos. Preserve its overall structure, compact typography, thin black grid lines, narrow margins, and monochrome professional appearance.

Required layout:

- Centred `Tax Invoice` title.
- Top-left exporter/company block.
- Top-right cells for Invoice No. & Date, Exporter’s Ref., and Buyer’s Order No. & Date.
- Next row: Consignee on the left and Buyer (if other than consignee) on the right.
- Contact/GST row, country of origin, and country of final destination.
- Logistics grid for pre-carriage, receipt place, vessel/flight, loading/discharge/final ports, and delivery/payment terms.
- Item table: Marks & No./Container No.; HSN/SAC; Item No.; Description of Goods; Quantity; Unit; Rate; and Amount. Retain the visual proportions of the sample but allow the columns required for correct invoices.
- Totals block for subtotal/total amount, applicable taxes, round-off, and grand total. Hide truly inapplicable zero-tax rows only according to a documented template rule.
- Selected bank details at bottom-left.
- Amount chargeable in words.
- Declaration at bottom-left.
- Signature/date, company name, optional signature image, signatory name, and designation at bottom-right.

Correct these source labels/spellings:

- `Vessel/Flight No.`
- `Port of Loading`
- `Amount chargeable (in words)`
- `actual prices`
- `Exporter’s Ref.`

Additional PDF requirements:

- Dynamic data only. Never hard-code Decorative Handicrafts, the sample buyer, account, signature, items, GSTIN, invoice number, or totals.
- Embed Unicode fonts supporting `₹`, Indian names, GSTIN, HSN/SAC, and common accented export-customer names.
- Keep text selectable when the selected PDF library supports it.
- Escape user content and prevent HTML/script injection in preview or PDF rendering.
- Repeat company/invoice identity and the item header on additional pages.
- Never split one item row across pages.
- Keep totals, amount in words, declaration, and signature together where possible; move the group to the next page when necessary.
- Add page `x of y` only if enabled.
- Browser preview and downloaded PDF must match closely.
- Generate from immutable issued snapshots, not current master records.
- Store a checksum, generator/template version, generated-at timestamp, and storage reference.
- Re-rendering an old invoice must use its snapshot and compatible template version or preserve the originally issued PDF.

Test PDFs with 1, 7, 20, and 50 items, long company/buyer addresses, long descriptions, multiple currencies, all tax modes, ₹, and missing optional fields.

---

## Immutable snapshots and auditability

At issue time, persist immutable snapshots for:

- organisation/company identity and address;
- tax identifiers;
- buyer and consignee;
- selected bank account;
- invoice number/date and terms;
- every item description, SKU, HSN/SAC, unit, quantity, rate, discount, and tax rate;
- calculation inputs and results;
- signatory and document configuration;
- template version.

Editing a master later must never change an issued invoice or its regenerated PDF.

Audit events must be append-only and cover authentication, invitations, role changes, settings, masters, draft changes where important, issue, number/date override, amendment, cancellation, payment/reversal, PDF generation/download/email, CSV export, and locked-period changes.

---

## Minimum database model

Create migrations, foreign keys, indexes, check constraints where supported, compound unique constraints, soft-delete/archive strategy, timestamps, actor fields, and TypeScript types for at least:

- users
- accounts/sessions/verification tokens required by the auth solution
- organisations
- organisation_members
- organisation_invitations
- companies
- company_bank_accounts
- buyers
- buyer_addresses
- units
- tax_rates
- items
- invoice_number_series
- invoice_number_voids
- invoices
- invoice_items
- invoice_revisions
- payments
- payment_allocations if the design permits one payment across invoices
- audit_logs
- generated_documents
- file_assets

Use `CHAR(36)` UUIDs or another deliberately chosen ID strategy compatible with the selected database and Prisma. Explain the indexing and performance trade-off before implementation.

Minimum `invoices` data:

- IDs and organisation/company/buyer/consignee/bank/series references
- status, invoice number, sequence number, invoice date, due date, financial year
- buyer order number/date and exporter reference
- currency code, place-of-supply state code, tax treatment/mode
- subtotal, invoice discount, other charges, IGST, CGST, SGST, round-off, grand total, paid total, balance
- amount in words
- all logistics fields, terms, notes, and declaration
- company, buyer, consignee, bank, calculation, and document snapshots
- revision/version and optimistic-lock field
- issued/cancelled/amended actor, time, and reason fields
- created/updated actor and timestamps

Minimum `invoice_items` data:

- invoice and optional item reference
- sort order, SKU, description, HSN/SAC, quantity, unit, rate, discount
- taxable amount, GST rate, IGST, CGST, SGST, and line total
- item snapshot/version data required for integrity

Define referential actions deliberately. Do not cascade-delete issued financial documents, payments, revisions, audit records, or generated documents.

---

## Dashboard, lists, and reporting

Dashboard:

- invoices issued this month;
- invoice value this month;
- amount received;
- outstanding balance;
- overdue invoices;
- recent invoices and payments.

Invoice list:

- server-side pagination, search, and sorting;
- filters for date range, company, buyer, status, currency, and invoice number;
- permission-aware row actions.

Reports:

- filtered invoice register;
- CSV export with stable headers and UTF-8 BOM where required for Excel;
- totals grouped by status/company/currency only when mathematically valid;
- do not add unlike currencies together without conversion and a declared rate source.

---

## UX and accessibility

- Responsive desktop-first UI.
- Clear onboarding for first organisation, company, bank account, buyer, item, and invoice.
- Accessible labels, focus states, keyboard navigation, validation summaries, and sufficient contrast.
- Searchable selectors for larger masters.
- Autosave with visible state and conflict handling.
- Skeleton/loading, empty, error, and offline/network-failure states.
- Toasts plus field-level errors; do not rely on toasts alone.
- Confirm destructive or irreversible actions and clearly explain invoice-number consumption.
- Use Indian date/number formatting by default but store canonical values.

---

## Testing and acceptance criteria

Add unit, integration, security, and end-to-end tests. At minimum prove:

- Two simultaneous issue requests cannot receive the same sequence or invoice number.
- A transaction failure cannot create a partially issued invoice.
- Cancelled/voided numbers are never reused.
- Cross-tenant reads and writes are blocked for every master and transaction.
- Role permissions are enforced on the server.
- Changing a company, bank, buyer, address, item, tax rate, logo, or signature does not alter an issued invoice.
- Intrastate tax splits correctly into CGST and SGST.
- Interstate tax uses IGST.
- Zero-rated/no-tax modes work as defined.
- Editor, database, CSV, and PDF totals are identical.
- Rounding edge cases and amount-in-words are correct.
- Manual number/date override requires permission, reason, uniqueness, unlocked period, and audit record.
- Payments update balances/status correctly; reversal restores them correctly.
- Issued invoices cannot be mutated through UI or direct API calls.
- PDF renders correctly with 1, 7, 20, and 50 items; headers repeat and nothing overlaps or clips.
- Long addresses/descriptions and Unicode/₹ render correctly.
- Protected files cannot be fetched by another tenant or unauthenticated URL guessing.
- Authentication, reset, invitation, rate limit, and CSRF protections behave as intended.
- Production build and the HostingRaja smoke-test deployment succeed.

For PDF acceptance, render generated PDFs to PNG during testing and inspect page dimensions, overflow, row splitting, headers, totals grouping, and font rendering. Do not treat “PDF file exists” as sufficient.

---

## Code quality and implementation rules

- Use strict TypeScript. Avoid `any`; explain unavoidable exceptions.
- Keep business calculations in pure, tested domain services, separate from React components and database adapters.
- Use a repository/service boundary that always requires tenant context.
- Use database transactions for issue, amendment/cancellation metadata, and payment allocation/reversal.
- Use idempotency keys for issue, payment, email, and other retry-sensitive mutations.
- Use structured application errors and safe user-facing messages.
- Avoid duplicated schemas/calculation logic.
- No pseudocode, fake implementations, TODO placeholders, disabled tests, or “coming soon” UI in completed phases.
- Do not change unrelated files or destroy my existing work.
- Never run destructive database migrations against production without a backup, review, and explicit approval.
- Seed only clearly fictional development data; never commit private customer data.

---

## Delivery workflow

Implement one approved phase at a time on a feature branch. Before each phase:

1. Inspect current repository status and preserve unrelated changes.
2. State the phase objective, decisions, files expected to change, migrations, and tests.
3. Ask only genuinely blocking questions.

During each phase:

- implement complete production code;
- add forward migrations and, where safe, rollback guidance;
- add tests alongside features;
- keep the app runnable;
- update setup/deployment documentation;
- use small, reviewable commits if I authorise commits.

Before stopping:

- run format check, lint, type-check, unit tests, integration tests, relevant end-to-end tests, and production build;
- fix failures caused by the phase;
- report commands and results honestly;
- summarise files changed, schema changes, security implications, manual setup, and the exact next phase;
- do not claim a deployment or test passed unless it actually ran.

Do not commit, push, deploy, alter DNS, modify production data, or run production migrations unless I explicitly request that action.

---

## Phased plan

- Phase 0: repository audit, HostingRaja capability proof, architecture decision, deployment smoke test
- Phase 1: project foundation, authentication, verified users, organisation onboarding, membership, permission service, application shell, tenant-isolation tests
- Phase 2: company, logo/signature file assets, and bank-account master
- Phase 3: buyer and multiple-address/consignee master
- Phase 4: units, tax rates, and item master
- Phase 5: organisation settings, financial years, locked periods, and atomic invoice-number series
- Phase 6: invoice editor, shared decimal calculation engine, draft workflow, autosave, and concurrency control
- Phase 7: issue, immutable snapshots, number voids, amendment/cancellation, audit logs, and document records
- Phase 8: A4 reference PDF, browser preview, protected storage, multi-page behaviour, print/download/email
- Phase 9: payments, balances, derived statuses, dashboard, invoice list, search, filters, and CSV register
- Phase 10: security/accessibility review, complete test matrix, backup/restore runbook, production deployment guide, and HostingRaja release verification

Start now with the mandatory audit and planning response only.
