# Backup And Restore Runbook

## Before Migration

1. Export the MySQL database from cPanel Backup or phpMyAdmin.
2. Confirm the exported file downloads successfully.
3. Record the migration folder name being deployed.
4. Confirm `.env` values are present in HostingRaja Node.js settings.

## Backup Command Option

If SSH provides `mysqldump`:

```bash
mysqldump -h DB_HOST -u DB_USER -p DB_NAME > backup-YYYY-MM-DD.sql
```

Store backups outside the application document root.

## Restore Option

Use phpMyAdmin import or:

```bash
mysql -h DB_HOST -u DB_USER -p DB_NAME < backup-YYYY-MM-DD.sql
```

## Restore Verification

After restore:

- Run `npx prisma migrate status`.
- Login to the app.
- Open dashboard.
- Open one issued invoice.
- Open its PDF.
- Check payments and balances.
- Export CSV.

Never restore over production during business hours without confirming downtime and backup integrity.
