# Invoice Management 26

Multi-tenant invoice management app for Decorative Handicrafts, built with Next.js, Prisma, MySQL/MariaDB, and PDFKit.

## Local Development

```bash
npm install
npm run prisma:generate
npm run dev
```

Open `http://127.0.0.1:3000`.

Keep secrets in `.env`. Do not commit `.env` files.

## HostingRaja Git/SSH Deployment

Use a private GitHub repository for source control. Do not push directly from local to HostingRaja unless you have confirmed SSH access.

Typical server update flow:

```bash
cd /home/decorati/app.decorative
git pull
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run build
```

Then restart the Node.js app from the HostingRaja/cPanel Node.js application panel.

Recommended HostingRaja Node.js settings:

- Application root: `app.decorative`
- Startup file: `.next/standalone/server.js` if using repository build output on server, or `server.js` if uploading the standalone package
- Node.js version: Node 22 if available
- Application URL: `https://app.decorativehandicraft.com`

Required production environment variables:

- `NODE_ENV=production`
- `DATABASE_URL`
- `AUTH_SECRET`
- `BANK_FIELD_ENCRYPTION_KEY`
- `UPLOAD_DIR=uploads`
- `NEXT_PUBLIC_APP_URL=https://app.decorativehandicraft.com`

## Production Deployment Checklist

- Confirm `.env` is not committed.
- Confirm HostingRaja Remote MySQL allows the deploying machine/server IP if needed.
- Run `npm install`.
- Run `npm run prisma:generate`.
- Run `npx prisma migrate deploy`.
- Run `npm run build`.
- Restart the Node.js app in cPanel.
- Confirm `uploads` remains writable and persistent.

## Post-Deploy Smoke Test

- Login opens and accepts valid credentials.
- Dashboard opens.
- Companies, buyers, items, invoices, payments, reports, settings, and credit notes pages open.
- Create a draft invoice.
- Add/edit/delete a draft invoice line.
- Issue an invoice with automatic invoice numbering.
- Open issued invoice PDF.
- Create a credit note draft from an issued invoice.
- Add a credit note line, issue it, and open credit note PDF.
- Record partial and final payments.
- Export invoice register CSV.

