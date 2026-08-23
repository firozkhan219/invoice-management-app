# Phase 2 Company And Bank Master

## Scope

This phase adds:

- Company master data with legal name, trading name, GSTIN, PAN, IEC, contact, address, signatory, declaration, terms, active/default flags.
- Bank-account master data attached to a company.
- Masked account number display using only the stored last four digits.
- Application-level AES-256-GCM encryption for account numbers.
- Logo/signature file-asset validation and metadata preparation boundaries.
- Companies page with create company and create bank account forms.
- Tenant-scoped service methods and audit records for company and bank-account creation.

## Sensitive Data

Bank account numbers are not stored as plaintext. The database stores:

- ciphertext
- IV
- authentication tag
- last four digits for masked display

Set `BANK_FIELD_ENCRYPTION_KEY` to a base64-encoded 32-byte key in every environment:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep this key backed up securely. Losing it means encrypted bank account numbers cannot be decrypted for invoice rendering.

## Migration

Migration file:

```text
prisma/migrations/20260823000200_phase_2_company_bank_master/migration.sql
```

On shared hosting, apply with:

```bash
npx prisma migrate deploy
```

Do not use `prisma migrate dev` against HostingRaja because the database user cannot create Prisma shadow databases.

## Acceptance Checks

```bash
npm run prisma:generate
npm run typecheck
npm run test
npm run lint
npm run build
npm audit --audit-level=high
```
