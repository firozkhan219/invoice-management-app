import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { settlementState } from "@/lib/payments/payment-status";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";

/**
 * Owner-only destructive actions: permanently deleting issued documents and resetting the
 * workspace to a fresh start. Callers must re-check the owner's password (and 2FA) first —
 * see verifyStepUp — these functions only enforce the role.
 */

export type PurgeEntity = "invoice" | "packing_list" | "credit_note";

export type ResetOptions = {
  /** Products (and their uploaded photos). */
  products: boolean;
  /** Buyers and their addresses. */
  buyers: boolean;
};

type Tx = Prisma.TransactionClient;

/* ---------- Permanent delete of one document ---------- */

export async function purgeDocument(context: TenantContext, entity: PurgeEntity, id: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "data:purge");

  const storageKeys: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    if (entity === "invoice") return purgeInvoice(tx, tenant, id, storageKeys);
    if (entity === "packing_list") return purgePackingList(tx, tenant, id);
    return purgeCreditNote(tx, tenant, id, storageKeys);
  }, { timeout: 30_000 });

  await removeStoredFiles(storageKeys);
  return result;
}

async function purgeInvoice(tx: Tx, tenant: TenantContext, invoiceId: string, storageKeys: string[]) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organisationId: tenant.organisationId },
    include: { paymentAllocations: true, creditNotes: { select: { id: true } }, documents: { select: { storageKey: true } } }
  });
  if (!invoice) throw new Error("Invoice not found.");

  const creditNoteIds = invoice.creditNotes.map((note) => note.id);
  storageKeys.push(...invoice.documents.map((document) => document.storageKey).filter((key): key is string => Boolean(key)));

  // Documents generated for this invoice and its credit notes, then the credit notes themselves.
  await tx.generatedDocument.deleteMany({ where: { organisationId: tenant.organisationId, invoiceId: invoice.id } });
  if (creditNoteIds.length) {
    await tx.creditNoteLine.deleteMany({ where: { creditNoteId: { in: creditNoteIds } } });
    await tx.creditNote.deleteMany({ where: { id: { in: creditNoteIds } } });
  }

  // Payments: remove this invoice's allocations; a payment left with no allocation is deleted too.
  const paymentIds = [...new Set(invoice.paymentAllocations.map((allocation) => allocation.paymentId))];
  await tx.paymentAllocation.deleteMany({ where: { invoiceId: invoice.id } });
  let paymentsDeleted = 0;
  for (const paymentId of paymentIds) {
    const remaining = await tx.paymentAllocation.count({ where: { paymentId } });
    if (remaining === 0) {
      await tx.payment.delete({ where: { id: paymentId } });
      paymentsDeleted += 1;
    }
  }

  await tx.invoiceRevision.deleteMany({ where: { invoiceId: invoice.id } });
  // Lines cascade; packing lists and converted invoices keep their rows with the link cleared.
  await tx.invoice.delete({ where: { id: invoice.id } });

  await tx.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "invoice.purge",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        documentType: invoice.documentType,
        status: invoice.status,
        grandTotal: invoice.grandTotal.toString(),
        currency: invoice.currency,
        creditNotesDeleted: creditNoteIds.length,
        paymentsDeleted
      }
    }
  });

  return { label: invoice.invoiceNumber || "Draft", creditNotesDeleted: creditNoteIds.length, paymentsDeleted };
}

async function purgePackingList(tx: Tx, tenant: TenantContext, packingListId: string) {
  const packingList = await tx.packingList.findFirst({ where: { id: packingListId, organisationId: tenant.organisationId } });
  if (!packingList) throw new Error("Packing list not found.");

  await tx.packingListLine.deleteMany({ where: { packingListId: packingList.id } });
  await tx.packingList.delete({ where: { id: packingList.id } });
  await tx.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "packing_list.purge",
      entityType: "packing_list",
      entityId: packingList.id,
      metadata: { packingListNumber: packingList.packingListNumber, status: packingList.status }
    }
  });
  return { label: packingList.packingListNumber || "Draft" };
}

async function purgeCreditNote(tx: Tx, tenant: TenantContext, creditNoteId: string, storageKeys: string[]) {
  const creditNote = await tx.creditNote.findFirst({
    where: { id: creditNoteId, organisationId: tenant.organisationId },
    include: { originalInvoice: true, documents: { select: { storageKey: true } } }
  });
  if (!creditNote) throw new Error("Credit note not found.");
  storageKeys.push(...creditNote.documents.map((document) => document.storageKey).filter((key): key is string => Boolean(key)));

  // An issued credit note still reduces the invoice balance; give that back first.
  if (creditNote.status === "issued") {
    const invoice = creditNote.originalInvoice;
    const creditedTotal = Prisma.Decimal.max(invoice.creditedTotal.sub(creditNote.grandTotal), 0);
    const settlement = settlementState(invoice.grandTotal, invoice.paidTotal, creditedTotal, invoice.status);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { creditedTotal, balanceDue: settlement.balanceDue, status: settlement.status, updatedById: tenant.userId, version: { increment: 1 } }
    });
  }

  await tx.generatedDocument.deleteMany({ where: { creditNoteId: creditNote.id } });
  await tx.creditNoteLine.deleteMany({ where: { creditNoteId: creditNote.id } });
  await tx.creditNote.delete({ where: { id: creditNote.id } });
  await tx.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "credit_note.purge",
      entityType: "credit_note",
      entityId: creditNote.id,
      metadata: { creditNoteNumber: creditNote.creditNoteNumber, status: creditNote.status, originalInvoiceId: creditNote.originalInvoiceId }
    }
  });
  return { label: creditNote.creditNoteNumber || "Draft", originalInvoiceId: creditNote.originalInvoiceId };
}

/* ---------- Reset the workspace ---------- */

/**
 * Erases every invoice, proforma, credit note, packing list and payment (and optionally products
 * and buyers), resets all number series to their starting numbers, and keeps companies, bank
 * accounts, settings, users and the audit log. A JSON backup of everything erased is written to
 * private storage first and recorded in the audit log so the owner can download it.
 */
export async function resetOrganisationData(context: TenantContext, options: ResetOptions) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "data:purge");
  const organisationId = tenant.organisationId;

  const { writePrivateDocument } = await import("@/lib/documents/document-storage");
  const backup = await collectBackup(organisationId, options);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupKey = `backups/${organisationId}/reset-${stamp}.json`;
  const stored = await writePrivateDocument(backupKey, Buffer.from(JSON.stringify(backup, null, 1), "utf8"));

  const fileKeys = [
    ...backup.generatedDocuments.map((document) => document.storageKey),
    ...(options.products ? backup.itemImages.map((asset) => asset.storageKey) : [])
  ].filter((key): key is string => Boolean(key));

  const counts = await prisma.$transaction(async (tx) => {
    const where = { organisationId };
    const result: Record<string, number> = {};
    result.generatedDocuments = (await tx.generatedDocument.deleteMany({ where })).count;
    result.paymentAllocations = (await tx.paymentAllocation.deleteMany({ where })).count;
    result.payments = (await tx.payment.deleteMany({ where })).count;
    await tx.creditNoteLine.deleteMany({ where });
    result.creditNotes = (await tx.creditNote.deleteMany({ where })).count;
    await tx.packingListLine.deleteMany({ where });
    result.packingLists = (await tx.packingList.deleteMany({ where })).count;
    await tx.invoiceRevision.deleteMany({ where });
    await tx.invoiceItem.deleteMany({ where });
    // Clear proforma links first so invoices can be deleted in any order.
    await tx.invoice.updateMany({ where: { organisationId, sourceProformaId: { not: null } }, data: { sourceProformaId: null } });
    result.invoices = (await tx.invoice.deleteMany({ where })).count;
    await tx.invoiceNumberVoid.deleteMany({ where });

    if (options.products) {
      await tx.fileAsset.deleteMany({ where: { organisationId, kind: "item_image" } });
      result.products = (await tx.item.deleteMany({ where })).count;
    }
    if (options.buyers) {
      await tx.buyerAddress.deleteMany({ where });
      result.buyers = (await tx.buyer.deleteMany({ where })).count;
    }

    // Every number series starts again at its starting number (INV/.../0001, CN/.../0001).
    for (const series of await tx.invoiceNumberSeries.findMany({ where })) {
      await tx.invoiceNumberSeries.update({ where: { id: series.id }, data: { nextSequence: series.startingNumber, lastResetKey: null } });
    }
    for (const series of await tx.creditNoteNumberSeries.findMany({ where })) {
      await tx.creditNoteNumberSeries.update({ where: { id: series.id }, data: { nextSequence: series.startingNumber, lastResetKey: null } });
    }

    await tx.auditLog.create({
      data: {
        organisationId,
        actorUserId: tenant.userId,
        action: "organisation.reset",
        entityType: "organisation",
        entityId: organisationId,
        metadata: { backupKey, backupBytes: stored.byteSize, options, counts: result }
      }
    });
    return result;
  }, { timeout: 120_000 });

  await removeStoredFiles(fileKeys);
  return { counts, backupKey };
}

/** Everything the reset is about to erase, as plain JSON. */
async function collectBackup(organisationId: string, options: ResetOptions) {
  const where = { organisationId };
  const [invoices, creditNotes, packingLists, payments, generatedDocuments, invoiceNumberVoids, numberSeries, creditNoteSeries] = await Promise.all([
    prisma.invoice.findMany({ where, include: { items: true, revisions: true } }),
    prisma.creditNote.findMany({ where, include: { lines: true } }),
    prisma.packingList.findMany({ where, include: { lines: true } }),
    prisma.payment.findMany({ where, include: { allocations: true } }),
    prisma.generatedDocument.findMany({ where }),
    prisma.invoiceNumberVoid.findMany({ where }),
    prisma.invoiceNumberSeries.findMany({ where }),
    prisma.creditNoteNumberSeries.findMany({ where })
  ]);
  const [items, itemImages, buyers] = await Promise.all([
    options.products ? prisma.item.findMany({ where }) : Promise.resolve([]),
    options.products ? prisma.fileAsset.findMany({ where: { organisationId, kind: "item_image" } }) : Promise.resolve([]),
    options.buyers ? prisma.buyer.findMany({ where, include: { addresses: true } }) : Promise.resolve([])
  ]);
  return {
    format: "invoice-management-reset-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    organisationId,
    options,
    invoices,
    creditNotes,
    packingLists,
    payments,
    generatedDocuments,
    invoiceNumberVoids,
    numberSeriesBeforeReset: numberSeries,
    creditNoteSeriesBeforeReset: creditNoteSeries,
    items,
    itemImages,
    buyers
  };
}

/** Backups made by earlier resets, newest first (for the owner's download list). */
export async function listResetBackups(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "data:purge");
  const logs = await prisma.auditLog.findMany({
    where: { organisationId: tenant.organisationId, action: "organisation.reset" },
    include: { actor: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  return logs.map((log) => {
    const metadata = (log.metadata ?? {}) as { backupKey?: string; backupBytes?: number; counts?: Record<string, number> };
    return { id: log.id, createdAt: log.createdAt, by: log.actor?.name || log.actor?.email || "", bytes: metadata.backupBytes ?? 0, counts: metadata.counts ?? {}, hasFile: Boolean(metadata.backupKey) };
  });
}

export async function readResetBackup(context: TenantContext, auditLogId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "data:purge");
  const log = await prisma.auditLog.findFirst({ where: { id: auditLogId, organisationId: tenant.organisationId, action: "organisation.reset" } });
  const key = (log?.metadata as { backupKey?: string } | null)?.backupKey;
  if (!log || !key) throw new Error("Backup not found.");
  const { readPrivateDocument } = await import("@/lib/documents/document-storage");
  return { data: await readPrivateDocument(key), filename: key.split("/").pop() || "backup.json" };
}

async function removeStoredFiles(keys: string[]) {
  if (keys.length === 0) return;
  const { deletePrivateDocument } = await import("@/lib/documents/document-storage");
  // Best effort: a missing file must not undo a delete that already committed.
  await Promise.allSettled(keys.map((key) => deletePrivateDocument(key)));
}
