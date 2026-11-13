# Online Invoice Management

The app supports private business workspaces, invoices, packing lists, and downloadable PDFs. The online configuration uses MySQL, persistent private uploads, and Caddy for automatic HTTPS. The existing offline database is left in place; this deployment starts with a separate database.

## Server deployment

Use a Linux server with Docker Engine and the Compose plugin, a domain pointing to its public IP, and inbound ports 80 and 443 available. This configuration runs one application instance; its login rate limiter is held in memory.

From the project directory, generate private configuration once:

```sh
node scripts/configure-online.mjs invoices.your-domain.com
docker compose --env-file .env.online up -d --build
```

The database must pass its health check before migrations run. The app starts only after migrations succeed. Caddy provisions HTTPS when domain DNS resolves to the server. Open the domain, create an account, add company details, buyers and products, then create an invoice and packing list.

## Updates and checks

```sh
docker compose --env-file .env.online up -d --build
docker compose --env-file .env.online ps
docker compose --env-file .env.online logs --tail=100 app migrate web
```

Verify sign-in, business setup, invoice issue and PDF download, packing list issue and PDF download, and sign-out. Verify a second account cannot access the first business's documents. Repeat these checks from a phone on another connection.

## Persistent data and backups

The database, uploaded files, and HTTPS certificates live in named Docker volumes. Keep encrypted off-server backups of the database and uploads together, plus `.env.online`. Bank details require the original encryption key. Do not run `docker compose down -v` on a live deployment: it removes these volumes. Follow the existing backup/restore runbook and verify restoration before relying on production backups.

Public registration creates separate business workspaces. Existing local accounts and offline documents are not imported automatically. Any transfer should be performed from a backup and reconciled against invoice counts and totals before switching over.

## Current deployment status

The application has been deployed to HostingRaja at `https://app.decorativehandicraft.com` using its Node.js application manager, not Docker. See `hostingraja-deployment-guide.md` for the actual service paths and hosting-specific worker limits. The Docker configuration remains an alternative deployment option and has not been tested on a Docker host.
