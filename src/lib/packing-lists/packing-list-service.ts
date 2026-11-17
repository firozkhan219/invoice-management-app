import { Prisma, type PackingListStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { calculatePackingTotals, lineVolumeCbm } from "@/lib/packing-lists/calculation";
import type {
  PackingListDraftInput,
  PackingListIssueInput,
  PackingListLineDeleteInput,
  PackingListLineInput,
  PackingListLineUpdateInput,
  PackingListStatusInput,
  QuickPackingLineInput
} from "@/lib/validation/packing-lists";

type InvoiceWithPackingSourceLines = Prisma.InvoiceGetPayload<{
  include: { items: { include: { item: true }, orderBy: { sortOrder: "asc" } } };
}>;

export type PackingListFilters = {
  status?: string;
  q?: string;
  source?: string;
};

const PACKING_STATUSES: readonly PackingListStatus[] = ["draft", "issued", "cancelled"];

export async function listPackingLists(context: TenantContext, filters: PackingListFilters = {}) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "documents:download");

  const where: Prisma.PackingListWhereInput = {
    organisationId: tenant.organisationId,
    ...(filters.status && PACKING_STATUSES.includes(filters.status as PackingListStatus)
      ? { status: filters.status as PackingListStatus }
      : {}),
    ...(filters.source === "invoice" ? { invoiceId: { not: null } } : {}),
    ...(filters.source === "manual" ? { invoiceId: null } : {}),
    ...(filters.q
      ? {
          OR: [
            { packingListNumber: { contains: filters.q } },
            { exportReference: { contains: filters.q } },
            { invoice: { invoiceNumber: { contains: filters.q } } },
            { buyer: { displayName: { contains: filters.q } } },
            { company: { legalName: { contains: filters.q } } }
          ]
        }
      : {})
  };

  return prisma.packingList.findMany({
    where,
    include: {
      invoice: true,
      company: { include: { logoAsset: true, signatureAsset: true } },
      buyer: true,
      consigneeBuyer: true,
      lines: { orderBy: { sortOrder: "asc" } }
    },
    orderBy: [{ packingListDate: "desc" }, { createdAt: "desc" }]
  });
}

export async function getPackingList(context: TenantContext, packingListId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "documents:download");

  return prisma.packingList.findFirst({
    where: { id: packingListId, organisationId: tenant.organisationId },
    include: {
      invoice: { include: { items: { include: { item: true }, orderBy: { sortOrder: "asc" } } } },
      company: { include: { logoAsset: true, signatureAsset: true } },
      buyer: true,
      consigneeBuyer: true,
      lines: { include: { item: true, invoiceItem: true }, orderBy: { sortOrder: "asc" } }
    }
  });
}

export async function getPackingListWorkspace(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "documents:download");

  const [invoices, companies, buyers, items] = await Promise.all([
    prisma.invoice.findMany({
      where: { organisationId: tenant.organisationId, status: { in: ["issued", "partially_paid", "paid"] } },
      include: { buyer: true, company: true },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 50
    }),
    prisma.company.findMany({ where: { organisationId: tenant.organisationId, isActive: true }, orderBy: { legalName: "asc" } }),
    prisma.buyer.findMany({ where: { organisationId: tenant.organisationId, isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.item.findMany({ where: { organisationId: tenant.organisationId, isActive: true }, orderBy: { name: "asc" } })
  ]);

  return { invoices, companies, buyers, items };
}

export async function createPackingListDraft(context: TenantContext, input: PackingListDraftInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    let invoice: InvoiceWithPackingSourceLines | null = null;

    if (input.invoiceId) {
      invoice = await tx.invoice.findFirst({
        where: {
          id: input.invoiceId,
          organisationId: tenant.organisationId,
          status: { in: ["issued", "partially_paid", "paid"] }
        },
        include: { items: { include: { item: true }, orderBy: { sortOrder: "asc" } } }
      });

      if (!invoice) throw new Error("Issued invoice not found.");
    }

    await validateMasterRefs(tx, tenant.organisationId, input);

    const packingList = await tx.packingList.create({
      data: {
        organisationId: tenant.organisationId,
        invoiceId: invoice?.id,
        companyId: input.companyId || invoice?.companyId,
        buyerId: input.buyerId || invoice?.buyerId,
        consigneeBuyerId: input.consigneeBuyerId || invoice?.consigneeBuyerId,
        packingListDate: input.packingListDate,
        exportReference: input.exportReference || invoice?.exporterReference,
        containerNumber: input.containerNumber,
        sealNumber: input.sealNumber,
        shipmentMode: input.shipmentMode,
        portOfLoading: input.portOfLoading || invoice?.portOfLoading,
        portOfDischarge: input.portOfDischarge || invoice?.portOfDischarge,
        finalDestination: input.finalDestination || invoice?.finalDestination,
        notes: input.notes,
        createdById: tenant.userId
      }
    });

    if (invoice?.items?.length) {
      await tx.packingListLine.createMany({
        data: invoice.items.map((line) => {
          const itemWeight = line.item?.weightKg || new Prisma.Decimal(0);
          const quantity = line.quantity;
          const netWeight = itemWeight.mul(quantity);

          return {
            organisationId: tenant.organisationId,
            packingListId: packingList.id,
            invoiceItemId: line.id,
            itemId: line.itemId,
            sortOrder: line.sortOrder,
            sku: line.sku,
            description: line.description,
            hsnSac: line.hsnSac,
            quantity,
            unitCode: line.unitCode,
            netWeightKg: netWeight,
            grossWeightKg: netWeight
          };
        })
      });
    }

    const saved = await updatePackingTotals(tx, packingList.id, tenant.organisationId, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.create",
        entityType: "packing_list",
        entityId: saved.id,
        metadata: { invoiceId: invoice?.id || null }
      }
    });

    return saved;
  });
}

/** Data for the one-page packing list form: issued invoices with their lines and product weights. */
export async function getQuickPackingData(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  const [invoices, companies, buyers, items] = await Promise.all([
    prisma.invoice.findMany({
      where: { organisationId: tenant.organisationId, status: { in: ["issued", "partially_paid", "paid"] } },
      include: {
        buyer: { select: { displayName: true } },
        items: { include: { item: { select: { weightKg: true } } }, orderBy: { sortOrder: "asc" } }
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: 50
    }),
    prisma.company.findMany({ where: { organisationId: tenant.organisationId, isActive: true }, orderBy: { legalName: "asc" } }),
    prisma.buyer.findMany({ where: { organisationId: tenant.organisationId, isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.item.findMany({
      where: { organisationId: tenant.organisationId, isActive: true },
      include: { unit: { select: { code: true } } },
      orderBy: { name: "asc" }
    })
  ]);

  return { invoices, companies, buyers, items };
}

/**
 * Creates a draft packing list with all its box lines in one transaction.
 * Lines come from the form (already edited by the user), so invoice lines are not auto-copied here.
 */
export async function createQuickPackingList(
  context: TenantContext,
  input: PackingListDraftInput,
  lines: QuickPackingLineInput[]
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");
  if (lines.length === 0) throw new Error("Add at least one box line.");

  return prisma.$transaction(async (tx) => {
    let invoice: { id: string; companyId: string | null; buyerId: string | null; consigneeBuyerId: string | null } | null = null;
    if (input.invoiceId) {
      invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organisationId: tenant.organisationId, status: { in: ["issued", "partially_paid", "paid"] } },
        select: { id: true, companyId: true, buyerId: true, consigneeBuyerId: true }
      });
      if (!invoice) throw new Error("Issued invoice not found.");
    }

    await validateMasterRefs(tx, tenant.organisationId, input);

    const itemIds = [...new Set(lines.map((line) => line.itemId).filter((id): id is string => Boolean(id)))];
    if (itemIds.length) {
      const count = await tx.item.count({ where: { id: { in: itemIds }, organisationId: tenant.organisationId } });
      if (count !== itemIds.length) throw new Error("A product on this packing list was not found.");
    }
    const invoiceItemIds = [...new Set(lines.map((line) => line.invoiceItemId).filter((id): id is string => Boolean(id)))];
    if (invoiceItemIds.length) {
      if (!invoice) throw new Error("Invoice lines need a source invoice.");
      const count = await tx.invoiceItem.count({
        where: { id: { in: invoiceItemIds }, organisationId: tenant.organisationId, invoiceId: invoice.id }
      });
      if (count !== invoiceItemIds.length) throw new Error("An invoice line on this packing list was not found.");
    }

    const packingList = await tx.packingList.create({
      data: {
        organisationId: tenant.organisationId,
        invoiceId: invoice?.id,
        companyId: input.companyId || invoice?.companyId,
        buyerId: input.buyerId || invoice?.buyerId,
        consigneeBuyerId: input.consigneeBuyerId || invoice?.consigneeBuyerId,
        packingListDate: input.packingListDate,
        exportReference: input.exportReference,
        containerNumber: input.containerNumber,
        sealNumber: input.sealNumber,
        shipmentMode: input.shipmentMode,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        finalDestination: input.finalDestination,
        notes: input.notes,
        createdById: tenant.userId
      }
    });

    await tx.packingListLine.createMany({
      data: lines.map((line, index) => ({
        organisationId: tenant.organisationId,
        packingListId: packingList.id,
        itemId: line.itemId,
        invoiceItemId: line.invoiceItemId,
        sortOrder: index + 1,
        packageNo: line.packageNo,
        marksAndNumbers: line.marksAndNumbers,
        sku: line.sku,
        description: line.description,
        hsnSac: line.hsnSac,
        quantity: new Prisma.Decimal(line.quantity),
        unitCode: line.unitCode,
        netWeightKg: new Prisma.Decimal(line.netWeightKg),
        grossWeightKg: new Prisma.Decimal(line.grossWeightKg),
        lengthCm: line.lengthCm === undefined ? undefined : new Prisma.Decimal(line.lengthCm),
        widthCm: line.widthCm === undefined ? undefined : new Prisma.Decimal(line.widthCm),
        heightCm: line.heightCm === undefined ? undefined : new Prisma.Decimal(line.heightCm),
        volumeCbm: lineVolumeCbm(line)
      }))
    });

    const saved = await updatePackingTotals(tx, packingList.id, tenant.organisationId, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.create",
        entityType: "packing_list",
        entityId: saved.id,
        metadata: { invoiceId: invoice?.id || null, lines: lines.length, quick: true }
      }
    });

    return saved;
  });
}

/** Draft fields a user may blank out; an empty submitted value for these is saved as null. */
export const CLEARABLE_PACKING_FIELDS = [
  "companyId",
  "buyerId",
  "consigneeBuyerId",
  "exportReference",
  "containerNumber",
  "sealNumber",
  "shipmentMode",
  "portOfLoading",
  "portOfDischarge",
  "finalDestination",
  "notes"
] as const;

export async function updatePackingListDraft(
  context: TenantContext,
  packingListId: string,
  input: PackingListDraftInput,
  clearedKeys: readonly string[] = []
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const current = await tx.packingList.findFirst({ where: { id: packingListId, organisationId: tenant.organisationId } });
    if (!current) throw new Error("Packing list not found.");
    if (current.status !== "draft") throw new Error("Only draft packing lists can be edited.");
    if (input.version && input.version !== current.version) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    await validateMasterRefs(tx, tenant.organisationId, input);

    const cleared = Object.fromEntries(
      CLEARABLE_PACKING_FIELDS.filter((key) => clearedKeys.includes(key)).map((key) => [key, null])
    );

    const packingList = await tx.packingList.update({
      where: { id: current.id },
      data: {
        companyId: input.companyId,
        buyerId: input.buyerId,
        consigneeBuyerId: input.consigneeBuyerId,
        packingListDate: input.packingListDate,
        exportReference: input.exportReference,
        containerNumber: input.containerNumber,
        sealNumber: input.sealNumber,
        shipmentMode: input.shipmentMode,
        portOfLoading: input.portOfLoading,
        portOfDischarge: input.portOfDischarge,
        finalDestination: input.finalDestination,
        notes: input.notes,
        ...cleared,
        version: { increment: 1 },
        updatedById: tenant.userId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.update",
        entityType: "packing_list",
        entityId: packingList.id
      }
    });

    return packingList;
  });
}

export async function addPackingListLine(context: TenantContext, input: PackingListLineInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "draft") throw new Error("Only draft packing lists can be edited.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    await assertLineRefs(tx, tenant.organisationId, packingList.invoiceId, input);

    const line = await tx.packingListLine.create({
      data: {
        organisationId: tenant.organisationId,
        packingListId: packingList.id,
        itemId: input.itemId,
        invoiceItemId: input.invoiceItemId,
        sortOrder: input.sortOrder,
        packageNo: input.packageNo,
        marksAndNumbers: input.marksAndNumbers,
        sku: input.sku,
        description: input.description,
        hsnSac: input.hsnSac,
        quantity: new Prisma.Decimal(input.quantity),
        unitCode: input.unitCode,
        netWeightKg: new Prisma.Decimal(input.netWeightKg),
        grossWeightKg: new Prisma.Decimal(input.grossWeightKg),
        lengthCm: input.lengthCm === undefined ? undefined : new Prisma.Decimal(input.lengthCm),
        widthCm: input.widthCm === undefined ? undefined : new Prisma.Decimal(input.widthCm),
        heightCm: input.heightCm === undefined ? undefined : new Prisma.Decimal(input.heightCm),
        volumeCbm: lineVolumeCbm(input)
      }
    });

    const updated = await updatePackingTotals(tx, packingList.id, tenant.organisationId, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list_line.create",
        entityType: "packing_list_line",
        entityId: line.id,
        metadata: { packingListId: packingList.id }
      }
    });

    return updated;
  });
}

export async function deletePackingListLine(context: TenantContext, input: PackingListLineDeleteInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId },
      include: { lines: true }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "draft") throw new Error("Only draft packing lists can be edited.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    const line = packingList.lines.find((item) => item.id === input.lineId);
    if (!line) throw new Error("Packing list line not found.");

    await tx.packingListLine.delete({ where: { id: line.id } });
    const updated = await updatePackingTotals(tx, packingList.id, tenant.organisationId, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list_line.delete",
        entityType: "packing_list_line",
        entityId: line.id,
        metadata: { packingListId: packingList.id }
      }
    });

    return updated;
  });
}

export async function updatePackingListLine(context: TenantContext, input: PackingListLineUpdateInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId },
      include: { lines: true }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "draft") throw new Error("Only draft packing lists can be edited.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    const line = packingList.lines.find((item) => item.id === input.lineId);
    if (!line) throw new Error("Packing list line not found.");

    await tx.packingListLine.update({
      where: { id: line.id },
      data: {
        sortOrder: input.sortOrder,
        packageNo: input.packageNo ?? null,
        marksAndNumbers: input.marksAndNumbers ?? null,
        sku: input.sku ?? null,
        description: input.description,
        hsnSac: input.hsnSac ?? null,
        quantity: new Prisma.Decimal(input.quantity),
        unitCode: input.unitCode ?? null,
        netWeightKg: new Prisma.Decimal(input.netWeightKg),
        grossWeightKg: new Prisma.Decimal(input.grossWeightKg),
        lengthCm: input.lengthCm === undefined ? null : new Prisma.Decimal(input.lengthCm),
        widthCm: input.widthCm === undefined ? null : new Prisma.Decimal(input.widthCm),
        heightCm: input.heightCm === undefined ? null : new Prisma.Decimal(input.heightCm),
        volumeCbm: lineVolumeCbm(input)
      }
    });

    const updated = await updatePackingTotals(tx, packingList.id, tenant.organisationId, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list_line.update",
        entityType: "packing_list_line",
        entityId: line.id,
        metadata: { packingListId: packingList.id }
      }
    });

    return updated;
  });
}

/** Moves an issued packing list back to draft. It keeps its number, and re-issuing reuses it. */
export async function reopenPackingList(context: TenantContext, input: PackingListStatusInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "issued") throw new Error("Only issued packing lists can be reopened.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    const reopened = await tx.packingList.update({
      where: { id: packingList.id },
      data: { status: "draft", updatedById: tenant.userId, version: { increment: 1 } }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.reopen",
        entityType: "packing_list",
        entityId: packingList.id,
        metadata: { packingListNumber: packingList.packingListNumber, reason: input.reason ?? null }
      }
    });

    return reopened;
  });
}

/** Cancels an issued packing list. The number stays used so it is never handed out again. */
export async function cancelPackingList(context: TenantContext, input: PackingListStatusInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:cancel");
  if (!input.reason) throw new Error("Enter a reason for cancelling.");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "issued") throw new Error("Only issued packing lists can be cancelled. Delete a draft instead.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");

    const cancelled = await tx.packingList.update({
      where: { id: packingList.id },
      data: { status: "cancelled", updatedById: tenant.userId, version: { increment: 1 } }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.cancel",
        entityType: "packing_list",
        entityId: packingList.id,
        metadata: { packingListNumber: packingList.packingListNumber, reason: input.reason }
      }
    });

    return cancelled;
  });
}

/** Deletes a draft that was never issued. Drafts that already hold a number must be cancelled instead. */
export async function deletePackingListDraft(context: TenantContext, input: PackingListStatusInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "draft") throw new Error("Only drafts can be deleted.");
    if (packingList.packingListNumber) {
      throw new Error("This draft already has number " + packingList.packingListNumber + ". Issue it again and cancel it instead.");
    }

    await tx.packingListLine.deleteMany({ where: { packingListId: packingList.id, organisationId: tenant.organisationId } });
    await tx.packingList.delete({ where: { id: packingList.id } });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.delete",
        entityType: "packing_list",
        entityId: packingList.id
      }
    });
  });
}

export async function issuePackingList(context: TenantContext, input: PackingListIssueInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  // Two people issuing at once can pick the same next number; the unique index rejects one, so retry it.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await issuePackingListOnce(tenant, input);
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
      if (!retryable || attempt >= 3) throw error;
    }
  }
}

async function issuePackingListOnce(
  tenant: TenantContext,
  input: PackingListIssueInput
) {
  return prisma.$transaction(async (tx) => {
    const packingList = await tx.packingList.findFirst({
      where: { id: input.packingListId, organisationId: tenant.organisationId },
      include: { lines: true }
    });
    if (!packingList) throw new Error("Packing list not found.");
    if (packingList.status !== "draft") throw new Error("Only draft packing lists can be issued.");
    if (packingList.version !== input.expectedVersion) throw new Error("Packing list was changed elsewhere. Refresh and try again.");
    const requirements = packingListIssueRequirements(packingList);
    if (requirements.length > 0) throw new Error(`Before issuing: ${requirements.join(", ")}.`);

    // A reopened packing list keeps the number it was first issued with.
    let packingListNumber = packingList.packingListNumber;
    let sequence = packingList.sequenceNumber;
    if (!packingListNumber) {
      const year = packingList.packingListDate.getUTCFullYear();
      const prefix = `PL/${year}/`;
      const last = await tx.packingList.aggregate({
        where: { organisationId: tenant.organisationId, packingListNumber: { startsWith: prefix } },
        _max: { sequenceNumber: true }
      });
      sequence = (last._max.sequenceNumber ?? 0) + 1;
      packingListNumber = `${prefix}${String(sequence).padStart(4, "0")}`;
    }

    const issued = await tx.packingList.update({
      where: { id: packingList.id },
      data: {
        status: "issued",
        packingListNumber,
        sequenceNumber: sequence,
        issuedById: tenant.userId,
        issuedAt: new Date(),
        version: { increment: 1 }
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "packing_list.issue",
        entityType: "packing_list",
        entityId: issued.id,
        metadata: { packingListNumber }
      }
    });

    return issued;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function generatePackingListPdf(context: TenantContext, packingListId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "documents:download");

  const packingList = await getPackingList(context, packingListId);
  if (!packingList) throw new Error("Packing list not found.");
  // Drafts render as a watermarked preview so the layout can be checked before finalising.
  const isDraft = packingList.status === "draft";
  if (!isDraft && !packingList.packingListNumber) throw new Error("Issued packing list is missing its number.");
  const documentNumber = isDraft ? "DRAFT" : packingList.packingListNumber!;

  const [{ packingListPdfFilename, renderPackingListPdf }, { readPrivateDocument }] = await Promise.all([
    import("@/lib/packing-lists/packing-list-pdf"),
    import("@/lib/documents/document-storage")
  ]);
  const [logo, signature] = await Promise.all([
    packingList.company?.logoAsset ? readAssetForPdf(readPrivateDocument, packingList.company.logoAsset) : Promise.resolve(null),
    packingList.company?.signatureAsset ? readAssetForPdf(readPrivateDocument, packingList.company.signatureAsset) : Promise.resolve(null)
  ]);
  const buffer = await renderPackingListPdf({
    packingListNumber: documentNumber,
    packingListDate: packingList.packingListDate,
    invoiceNumber: packingList.invoice?.invoiceNumber,
    invoiceDate: packingList.invoice?.invoiceDate,
    exportReference: packingList.exportReference,
    containerNumber: packingList.containerNumber,
    sealNumber: packingList.sealNumber,
    shipmentMode: packingList.shipmentMode,
    portOfLoading: packingList.portOfLoading,
    portOfDischarge: packingList.portOfDischarge,
    finalDestination: packingList.finalDestination,
    company: asRecord(packingList.company),
    buyer: asRecord(packingList.buyer),
    consignee: asRecord(packingList.consigneeBuyer || packingList.buyer),
    logo,
    signature,
    lines: packingList.lines.map((line) => ({
      sortOrder: line.sortOrder,
      packageNo: line.packageNo,
      marksAndNumbers: line.marksAndNumbers,
      sku: line.sku,
      description: line.description,
      hsnSac: line.hsnSac,
      quantity: line.quantity.toString(),
      unitCode: line.unitCode,
      netWeightKg: line.netWeightKg.toString(),
      grossWeightKg: line.grossWeightKg.toString(),
      lengthCm: line.lengthCm?.toString(),
      widthCm: line.widthCm?.toString(),
      heightCm: line.heightCm?.toString(),
      volumeCbm: line.volumeCbm.toString()
    })),
    totals: {
      packages: packingList.totalPackages,
      quantity: packingList.totalQuantity.toString(),
      netWeightKg: packingList.totalNetWeightKg.toString(),
      grossWeightKg: packingList.totalGrossWeightKg.toString(),
      volumeCbm: packingList.totalVolumeCbm.toString()
    },
    notes: packingList.notes,
    draft: isDraft
  });

  if (isDraft) {
    return { buffer, filename: `packing-list-draft-preview.pdf` };
  }

  await prisma.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "packing_list_pdf.generate",
      entityType: "packing_list",
      entityId: packingList.id,
      metadata: { byteSize: buffer.byteLength }
    }
  });

  return { buffer, filename: packingListPdfFilename(documentNumber) };
}

export function packingListIssueRequirements(packingList: {
  companyId: string | null;
  buyerId: string | null;
  lines: unknown[];
  shipmentMode: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
}) {
  // Ports only make sense for sea and air shipments; road, courier and hand delivery need just a destination.
  const needsPorts = shipmentNeedsPorts(packingList.shipmentMode);
  return [
    packingList.companyId ? null : "select a company",
    packingList.buyerId ? null : "select a buyer",
    packingList.lines.length > 0 ? null : "add at least one packing line",
    packingList.shipmentMode ? null : "enter shipment mode",
    !needsPorts || packingList.portOfLoading ? null : "enter port of loading",
    !needsPorts || packingList.portOfDischarge ? null : "enter port of discharge",
    packingList.finalDestination ? null : "enter final destination"
  ].filter((requirement): requirement is string => Boolean(requirement));
}

/** True for sea/air (and unknown) shipment modes; false for road, rail, courier and hand delivery. */
export function shipmentNeedsPorts(shipmentMode: string | null | undefined) {
  const mode = (shipmentMode || "").toLowerCase();
  if (!mode) return true;
  return !/(road|truck|lorry|courier|hand|rail|train|tempo|local)/.test(mode);
}

async function assertLineRefs(
  tx: Prisma.TransactionClient,
  organisationId: string,
  invoiceId: string | null,
  input: { itemId?: string; invoiceItemId?: string }
) {
  if (input.itemId) {
    const item = await tx.item.count({ where: { id: input.itemId, organisationId } });
    if (!item) throw new Error("Item not found.");
  }

  if (input.invoiceItemId) {
    if (!invoiceId) throw new Error("This packing list is not linked to an invoice.");
    const invoiceItem = await tx.invoiceItem.count({ where: { id: input.invoiceItemId, organisationId, invoiceId } });
    if (!invoiceItem) throw new Error("That line does not belong to the linked invoice.");
  }
}

async function validateMasterRefs(
  tx: Prisma.TransactionClient,
  organisationId: string,
  input: Pick<PackingListDraftInput, "companyId" | "buyerId" | "consigneeBuyerId">
) {
  if (input.companyId) {
    const count = await tx.company.count({ where: { id: input.companyId, organisationId } });
    if (!count) throw new Error("Company not found.");
  }

  if (input.buyerId) {
    const count = await tx.buyer.count({ where: { id: input.buyerId, organisationId } });
    if (!count) throw new Error("Buyer not found.");
  }

  if (input.consigneeBuyerId) {
    const count = await tx.buyer.count({ where: { id: input.consigneeBuyerId, organisationId } });
    if (!count) throw new Error("Consignee not found.");
  }
}

async function updatePackingTotals(
  tx: Prisma.TransactionClient,
  packingListId: string,
  organisationId: string,
  userId: string
) {
  const lines = await tx.packingListLine.findMany({
    where: { packingListId, organisationId },
    orderBy: { sortOrder: "asc" }
  });
  const totals = calculatePackingTotals(lines);

  return tx.packingList.update({
    where: { id: packingListId },
    data: {
      totalPackages: totals.packageCount,
      totalQuantity: totals.quantity,
      totalNetWeightKg: totals.netWeightKg,
      totalGrossWeightKg: totals.grossWeightKg,
      totalVolumeCbm: totals.volumeCbm,
      version: { increment: 1 },
      updatedById: userId
    }
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function readAssetForPdf(
  readPrivateDocument: (storageKey: string) => Promise<Buffer>,
  asset: { storageKey: string; mimeType: string }
) {
  try {
    return {
      data: await readPrivateDocument(asset.storageKey),
      mimeType: asset.mimeType
    };
  } catch {
    return null;
  }
}
