import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function databaseUrlWithConnectionLimit() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    if (!["mysql:", "postgresql:", "postgres:"].includes(url.protocol)) {
      return databaseUrl;
    }

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrlWithConnectionLimit(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when running against the offline SQLite build (DATABASE_URL uses the file: scheme). */
export function isSqliteDatabase(): boolean {
  return (process.env.DATABASE_URL || "").startsWith("file:");
}

/**
 * Locks an invoice row for the rest of the transaction so payments and credits against it are applied
 * one at a time. MySQL needs an explicit row lock; SQLite has no FOR UPDATE but already runs write
 * transactions one at a time, so there it is a no-op.
 */
export async function lockInvoiceRow(
  tx: { $queryRaw: PrismaClient["$queryRaw"] },
  invoiceId: string,
  organisationId?: string
): Promise<void> {
  if (isSqliteDatabase()) return;
  if (organisationId) {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} AND organisation_id = ${organisationId} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
  }
}
