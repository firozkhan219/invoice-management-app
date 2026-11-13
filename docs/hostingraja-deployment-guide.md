# HostingRaja Deployment Guide

## Production App

### Active deployment — 23 October 2026

- Public URL: `https://app.decorativehandicraft.com`
- cPanel Node.js application root: `/home/decorati/invoice-service`
- Startup file: `server.cjs`
- Release source and build: `/home/decorati/invoice-online-20261023`
- Private runtime environment: `/home/decorati/invoice-online-20261023/.env` (mode 600)
- Private uploads: `/home/decorati/invoice-uploads`
- Dedicated MySQL database: `decorati_invoice26`
- Dedicated database login: `decorati_inv26`; privileges are limited to this database.
- Private baseline database and environment backup: `/home/decorati/invoice-backups` (directory mode 700, files mode 600). This is a one-time server backup; scheduled and off-server backups are not configured.
- Original `/home/decorati/app.decorative` deployment and offline data were preserved. The new database starts separately; no old records were imported.

The startup wrapper loads the private environment and sets CPU affinity to cores 0 and 1 before loading the standalone server. This hosting account exposes 32 CPU cores but limits process/thread usage; unbounded Next.js and Prisma workers fail with EAGAIN. The build uses `experimental.cpus: 2` and must run with CPU affinity as below.

Update this release through cPanel Terminal, with the Node.js app stopped during rebuilding:

```sh
cd /home/decorati/invoice-online-20261023
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
taskset -c 0,1 node node_modules/prisma/build/index.js migrate deploy
taskset -c 0,1 node node_modules/next/dist/bin/next build
node scripts/prepare-standalone-assets.mjs
```

Then start/restart `invoice-service` from Setup Node.js App. Back up the database, uploads, and private environment together before future updates. Keep the existing bank encryption key for all future updates to this database.

The public app was checked with an isolated deployment verification workspace, including registration, company and buyer creation, invoice numbering, invoice issuance, and conversion to an issued packing list. Test records belong to that workspace, not to new business accounts. Both PDF renderers now draw page-number footers without adding a blank page, with regression checks on page count.

### General deployment reference

- URL: `https://app.decorativehandicraft.com`
- Node.js version: use the newest available LTS in the panel. Current smoke testing used Node.js 22.
- For a new installation, choose a private application root separately from the domain document root.
- Startup file: `.next/standalone/server.js` when building in the project directory.
- Enable the domain's SSL certificate and force HTTPS before signing in; production session cookies require HTTPS.

## Environment Variables

Set these in HostingRaja Node.js app settings:

- `NODE_ENV=production`
- `DATABASE_URL`
- `AUTH_SECRET`
- `BANK_FIELD_ENCRYPTION_KEY`
- `UPLOAD_DIR=uploads`
- `NEXT_PUBLIC_APP_URL=https://app.decorativehandicraft.com`
- `ALLOWED_ORIGIN=https://app.decorativehandicraft.com`

Use an absolute persistent path for `UPLOAD_DIR`, for example `/home/decorati/invoice-uploads`, and ensure the Node.js application user can write to it. Keep the existing bank encryption key when using an existing database.

Do not paste real secrets into documentation or Git.

## Build And Migration

On the server or deployment shell:

```bash
npm ci
npm run prisma:generate
npm run build
```

`npm run build` applies production migrations before building and copies static assets into standalone output. Back up the database and private uploads before running it. Do not use `prisma migrate dev` against the shared MySQL database. Never upload local `.env`, SQLite databases, or the Windows offline package into the public document root.

## Restart

After upload/build/migration, restart the Node.js app from the HostingRaja Node.js application panel.

## Smoke Tests

After restart, test:

- `/login` loads over HTTPS with styling intact.
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
- Create a packing list, issue it, and download its PDF.
- Sign out and verify protected pages redirect to sign-in.
- Open the app from a phone using mobile data.

If remote MySQL is unreachable from local development, update cPanel Remote Database Access with the current public IPv4.
