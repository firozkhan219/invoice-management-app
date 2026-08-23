# HostingRaja Deployment Guide

## Production App

- URL: `https://app.decorativehandicraft.com`
- Node.js version: use the newest available LTS in the panel. Current smoke testing used Node.js 22.
- Startup file for Next standalone deployment: confirm after build packaging; for local development use `npm run dev`.

## Environment Variables

Set these in HostingRaja Node.js app settings:

- `NODE_ENV=production`
- `DATABASE_URL`
- `AUTH_SECRET`
- `BANK_FIELD_ENCRYPTION_KEY`
- `UPLOAD_DIR=uploads`
- `NEXT_PUBLIC_APP_URL=https://app.decorativehandicraft.com`

Do not paste real secrets into documentation or Git.

## Build And Migration

On the server or deployment shell:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run build
```

Use `npx prisma migrate deploy` on HostingRaja. Do not use `prisma migrate dev` against the shared MySQL database.

## Restart

After upload/build/migration, restart the Node.js app from the HostingRaja Node.js application panel.

## Smoke Tests

After restart, test:

- `/api/health` returns OK.
- `/api/env-check` shows required env vars true if smoke server is still deployed.
- Login works.
- Dashboard opens.
- Company, buyer, item, invoice, and payment pages open.
- Create a draft invoice.
- Add line item.
- Issue invoice.
- Open PDF.
- Record partial payment.
- Record final payment.
- Export invoice register CSV.

If remote MySQL is unreachable from local development, update cPanel Remote Database Access with the current public IPv4.
