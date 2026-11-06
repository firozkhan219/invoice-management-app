import { Prisma, type InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateInvoiceTotals, resolveTaxMode } from "@/lib/invoices/calculation";
import { canDeleteDraftInvoiceStatus, draftIssueRequirements } from "@/lib/invoices/lifecycle";
import type { InvoicePdfData, InvoicePdfLine } from "@/lib/invoices/invoice-pdf";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { financialYearLabel } from "@/lib/settings/financial-year";
import { assertDateNotLocked } from "@/lib/settings/locked-periods";
import { periodRangeForRule, planSequence, renderInvoiceNumber } from "@/lib/settings/number-series";
import { bankRecordForDocument } from "@/lib/companies/bank-document";
import type {
  CancelInvoiceInput,
  DeleteDraftInvoiceInput,
  InvoiceDraftInput,
  InvoiceItemDeleteInput,
  InvoiceItemInput,
  InvoiceItemUpdateInput,
  IssueInvoiceInput
} from "@/lib/validation/invoices";

export type InvoiceListFilters = {
  q?: string;
  status?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
};

type InvoiceSnapshotSource = {
  company: unknown | null;
  buyer: unknown | null;
  consigneeBuyer: unknown | null;
  billingAddress: unknown | null;
  shippingAddress: unknown | null;
  bankAccount: unknown | null;
  subtotal: Prisma.Decimal;
  invoiceDiscount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  items: unknown[];
};

type InvoicePdfSource = InvoiceSnapshotSource & {
  invoiceNumber: string | null;
  invoiceDate: Date;
  dueDate: Date | null;
  currency: string;
  buyerOrderNumber: string | null;
  buyerOrderDate: Date | null;
  exporterReference: string | null;
  preCarriageBy: string | null;
  placeOfReceipt: string | null;
  vesselFlightNo: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
  termsOfDelivery: string | null;
  companySnapshot: unknown | null;
  buyerSnapshot: unknown | null;
  consigneeSnapshot: unknown | null;
  bankSnapshot: unknown | null;
  calculationSnapshot: unknown | null;
  notes: string | null;
  declaration: string | null;
};

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "issued", "partially_paid", "paid", "cancelled", "amended"];

function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listInvoices(context: TenantContext, filters: InvoiceListFilters = {}) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");
  const where: Prisma.InvoiceWhereInput = {
    organisationId: tenant.organisationId,
    ...(filters.status && INVOICE_STATUSES.includes(filters.status as InvoiceStatus) ? { status: filters.status as InvoiceStatus } : {}),
    ...(filters.currency ? { currency: filters.currency.toUpperCase() } : {}),
    ...(validDate(filters.dateFrom) || validDate(filters.dateTo) ? {
      invoiceDate: {
        ...(validDate(filters.dateFrom) ? { gte: validDate(filters.dateFrom) } : {}),
        ...(validDate(filters.dateTo) ? { lte: validDate(filters.dateTo) } : {})
      }
    } : {}),
    ...(filters.q ? {
      OR: [
        { invoiceNumber: { contains: filters.q } },
        { buyer: { displayName: { contains: filters.q } } },
        { company: { legalName: { contains: filters.q } } }
      ]
    } : {})
  };

  return prisma.invoice.findMany({
    where,
    include: { company: true, buyer: true, items: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }]
  });
}

export async function getInvoice(context: TenantContext, invoiceId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");

  return prisma.invoice.findFirst({
    where: { id: invoiceId, organisationId: tenant.organisationId },
    include: {
      company: { include: { logoAsset: true, signatureAsset: true } },
      buyer: true,
      consigneeBuyer: true,
      billingAddress: true,
      shippingAddress: true,
      bankAccount: true,
      items: { orderBy: { sortOrder: "asc" } },
      revisions: {
        include: { createdBy: true },
        orderBy: { revisionNumber: "desc" }
      },
      creditNotes: {
        include: { createdBy: true },
        orderBy: { createdAt: "desc" }
      },
      packingLists: {
        include: { lines: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ packingListDate: "desc" }, { createdAt: "desc" }]
      }
    }
  });
}

export async function getInvoiceEditorData(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: tenant.organisationId }
  });
  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: { legalName: "asc" }
  });
  const buyers = await prisma.buyer.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    include: { addresses: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { displayName: "asc" }
  });
  const bankAccounts = await prisma.companyBankAccount.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: { bankName: "asc" }
  });
  const masterItems = await prisma.item.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    include: { unit: true, taxRate: true },
    orderBy: { name: "asc" }
  });
  const settings = await prisma.organisationSettings.findUnique({
    where: { organisationId: tenant.organisationId }
  });
  const series = await prisma.invoiceNumberSeries.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });

  return { organisation, companies, buyers, bankAccounts, masterItems, settings, series };
}

export async function getInvoiceIssueOptions(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: tenant.organisationId }
  });
  const series = await prisma.invoiceNumberSeries.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });

  return { organisation, series };
}

export const CLEARABLE_DRAFT_FIELDS = [
  "companyId",
  "buyerId",
  "consigneeBuyerId",
  "billingAddressId",
  "shippingAddressId",
  "bankAccountId",
  "dueDate",
  "placeOfSupplyStateCode",
  "buyerOrderNumber",
  "buyerOrderDate",
  "exporterReference",
  "preCarriageBy",
  "placeOfReceipt",
  "vesselFlightNo",
  "portOfLoading",
  "portOfDischarge",
  "finalDestination",
  "termsOfDelivery",
  "notes",
  "declaration"
] as const;

type ClearableDraftField = typeof CLEARABLE_DRAFT_FIELDS[number];

function draftData(input: InvoiceDraftInput, clear: readonly string[] = []) {
  const fields: Record<string, unknown> = { ...input };
  delete fields.version;
  for (const key of clear) {
    if ((CLEARABLE_DRAFT_FIELDS as readonly string[]).includes(key)) fields[key] = null;
  }
  return fields as Omit<InvoiceDraftInput, "version" | ClearableDraftField> & {
    [K in ClearableDraftField]?: InvoiceDraftInput[K] | null;
  };
}

export async function createInvoiceDraft(context: TenantContext, input: InvoiceDraftInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    await validateReferences(tx, tenant.organisationId, input);

    const created = await tx.invoice.create({
      data: {
        ...draftData(input),
        organisationId: tenant.organisationId,
        createdById: tenant.userId,
        paidTotal: new Prisma.Decimal(0),
        balanceDue: new Prisma.Decimal(0)
      }
    });
    const invoice = await recalculateDraft(tx, created.id, tenant.userId, { bumpVersion: false });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_draft.create",
        entityType: "invoice",
        entityId: invoice.id
      }
    });

    return invoice;
  });
}

export async function updateInvoiceDraft(
  context: TenantContext,
  invoiceId: string,
  input: InvoiceDraftInput,
  clear: readonly string[] = []
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findFirst({
      where: { id: invoiceId, organisationId: tenant.organisationId }
    });

    if (!current) throw new Error("Invoice not found.");
    if (current.status !== "draft") throw new Error("Only draft invoices can be edited.");
    if (input.version && input.version !== current.version) throw new Error("Invoice was changed elsewhere. Refresh and try again.");

    const data = draftData(input, clear);
    const merged = (key: "companyId" | "buyerId" | "consigneeBuyerId" | "billingAddressId" | "shippingAddressId" | "bankAccountId") =>
      data[key] === null ? null : (data[key] ?? current[key]);
    await validateReferences(tx, tenant.organisationId, {
      companyId: merged("companyId"),
      buyerId: merged("buyerId"),
      consigneeBuyerId: merged("consigneeBuyerId"),
      billingAddressId: merged("billingAddressId"),
      shippingAddressId: merged("shippingAddressId"),
      bankAccountId: merged("bankAccountId")
    });

    await tx.invoice.update({
      where: { id: current.id },
      data: { ...data, updatedById: tenant.userId }
    });
    const invoice = await recalculateDraft(tx, current.id, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_draft.update",
        entityType: "invoice",
        entityId: invoice.id
      }
    });

    return invoice;
  });
}

export async function deleteDraftInvoice(context: TenantContext, input: DeleteDraftInvoiceInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, organisationId: tenant.organisationId },
      select: { id: true, status: true, invoiceNumber: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (!canDeleteDraftInvoiceStatus(invoice.status)) throw new Error("Only draft invoices can be deleted.");

    await tx.invoiceItem.deleteMany({
      where: { invoiceId: invoice.id, organisationId: tenant.organisationId }
    });
    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_draft.delete",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber }
      }
    });
    await tx.invoice.delete({
      where: { id: invoice.id }
    });

    return invoice;
  });
}

/** Fills a line from the catalog item when fields were left blank, and checks required values. */
async function resolveLineValues(
  tx: Prisma.TransactionClient,
  organisationId: string,
  input: InvoiceItemInput
) {
  const master = input.itemId
    ? await tx.item.findFirst({
        where: { id: input.itemId, organisationId },
        include: { unit: true, taxRate: true }
      })
    : null;
  if (input.itemId && !master) throw new Error("Item not found.");

  const description = input.description ?? master?.description ?? master?.name;
  if (!description) throw new Error("Description is required for a manual line.");
  const rate = input.rate ?? (master?.saleRate ? master.saleRate.toString() : undefined);
  if (rate === undefined) throw new Error("Rate is required (the selected item has no sale rate).");
  const gstRate = input.gstRate ?? (master?.taxRate ? master.taxRate.rate.toString() : 0);

  return {
    itemId: master?.id ?? null,
    sku: input.sku ?? master?.sku ?? null,
    description,
    hsnSac: input.hsnSac ?? master?.hsnSac ?? null,
    unitCode: input.unitCode ?? master?.unit?.code ?? null,
    quantity: new Prisma.Decimal(input.quantity),
    rate: new Prisma.Decimal(rate),
    discountAmount: new Prisma.Decimal(input.discountAmount),
    gstRate: new Prisma.Decimal(gstRate)
  };
}

async function loadEditableDraft(
  tx: Prisma.TransactionClient,
  organisationId: string,
  invoiceId: string,
  expectedVersion: number,
  verb: string
) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organisationId },
    include: { items: true }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "draft") throw new Error(`Only draft invoice lines can be ${verb}.`);
  if (invoice.version !== expectedVersion) throw new Error("Invoice was changed elsewhere. Refresh and try again.");
  return invoice;
}

export async function addInvoiceItem(context: TenantContext, input: InvoiceItemInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableDraft(tx, tenant.organisationId, input.invoiceId, input.expectedVersion, "edited");
    const values = await resolveLineValues(tx, tenant.organisationId, input);
    const nextSortOrder = invoice.items.reduce((max, line) => Math.max(max, line.sortOrder), 0) + 1;

    await tx.invoiceItem.create({
      data: {
        ...values,
        organisationId: tenant.organisationId,
        invoiceId: invoice.id,
        sortOrder: nextSortOrder
      }
    });

    const updatedInvoice = await recalculateDraft(tx, invoice.id, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_item.create",
        entityType: "invoice",
        entityId: invoice.id
      }
    });

    return updatedInvoice;
  });
}

export async function updateInvoiceItem(context: TenantContext, input: InvoiceItemUpdateInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableDraft(tx, tenant.organisationId, input.invoiceId, input.expectedVersion, "edited");
    const currentLine = invoice.items.find((item) => item.id === input.lineItemId);
    if (!currentLine) throw new Error("Invoice line item not found.");

    const values = await resolveLineValues(tx, tenant.organisationId, input);
    await tx.invoiceItem.update({
      where: { id: currentLine.id },
      data: { ...values, sortOrder: input.sortOrder ?? currentLine.sortOrder }
    });

    const updatedInvoice = await recalculateDraft(tx, invoice.id, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_item.update",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { lineItemId: currentLine.id }
      }
    });

    return updatedInvoice;
  });
}

export async function deleteInvoiceItem(context: TenantContext, input: InvoiceItemDeleteInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableDraft(tx, tenant.organisationId, input.invoiceId, input.expectedVersion, "deleted");
    const currentLine = invoice.items.find((item) => item.id === input.lineItemId);
    if (!currentLine) throw new Error("Invoice line item not found.");

    await tx.invoiceItem.delete({
      where: { id: currentLine.id }
    });

    const updatedInvoice = await recalculateDraft(tx, invoice.id, tenant.userId);

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_item.delete",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { lineItemId: currentLine.id }
      }
    });

    return updatedInvoice;
  });
}

function placeOfSupplyFor(invoice: {
  placeOfSupplyStateCode: string | null;
  shippingAddress: { stateCode: string | null } | null;
  billingAddress: { stateCode: string | null } | null;
}): string | null {
  return invoice.placeOfSupplyStateCode || invoice.shippingAddress?.stateCode || invoice.billingAddress?.stateCode || null;
}

/**
 * Recomputes every line and the invoice totals from scratch with the effective tax mode
 * (automatic → IGST or CGST+SGST from company state vs place of supply) and saves them.
 */
async function recalculateDraft(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string,
  options: { bumpVersion?: boolean } = {}
) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      company: { select: { stateCode: true } },
      shippingAddress: { select: { stateCode: true } },
      billingAddress: { select: { stateCode: true } }
    }
  });
  const effectiveMode = resolveTaxMode(invoice.taxMode, {
    supplierStateCode: invoice.company?.stateCode,
    placeOfSupplyStateCode: placeOfSupplyFor(invoice)
  });
  const totals = calculateInvoiceTotals(invoice.items, effectiveMode, invoice.invoiceDiscount, invoice.otherCharges);

  for (const [index, line] of invoice.items.entries()) {
    const calculated = totals.lines[index];
    await tx.invoiceItem.update({
      where: { id: line.id },
      data: {
        taxableAmount: calculated.taxableAmount,
        igstAmount: calculated.igstAmount,
        cgstAmount: calculated.cgstAmount,
        sgstAmount: calculated.sgstAmount,
        lineTotal: calculated.lineTotal
      }
    });
  }

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal: totals.subtotal,
      taxableTotal: totals.taxableTotal,
      igstTotal: totals.igstTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paidTotal: new Prisma.Decimal(0),
      balanceDue: new Prisma.Decimal(0),
      updatedById: userId,
      ...(options.bumpVersion === false ? {} : { version: { increment: 1 } })
    }
  });
}

type ReferenceInput = {
  companyId?: string | null;
  buyerId?: string | null;
  consigneeBuyerId?: string | null;
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  bankAccountId?: string | null;
};

async function validateReferences(
  tx: Prisma.TransactionClient,
  organisationId: string,
  input: ReferenceInput
) {
  if (input.companyId) {
    const exists = await tx.company.count({ where: { id: input.companyId, organisationId } });
    if (!exists) throw new Error("Company not found.");
  }
  if (input.buyerId) {
    const exists = await tx.buyer.count({ where: { id: input.buyerId, organisationId } });
    if (!exists) throw new Error("Buyer not found.");
  }
  if (input.consigneeBuyerId) {
    const exists = await tx.buyer.count({ where: { id: input.consigneeBuyerId, organisationId } });
    if (!exists) throw new Error("Consignee not found.");
  }
  if (input.billingAddressId) {
    const address = await tx.buyerAddress.findFirst({ where: { id: input.billingAddressId, organisationId }, select: { buyerId: true } });
    if (!address) throw new Error("Billing address not found.");
    if (input.buyerId && address.buyerId !== input.buyerId) throw new Error("Billing address must belong to the selected buyer.");
  }
  if (input.shippingAddressId) {
    const address = await tx.buyerAddress.findFirst({ where: { id: input.shippingAddressId, organisationId }, select: { buyerId: true } });
    if (!address) throw new Error("Shipping address not found.");
    const allowedBuyers = [input.buyerId, input.consigneeBuyerId].filter(Boolean);
    if (allowedBuyers.length > 0 && !allowedBuyers.includes(address.buyerId)) {
      throw new Error("Shipping address must belong to the buyer or the consignee.");
    }
  }
  if (input.bankAccountId) {
    const account = await tx.companyBankAccount.findFirst({ where: { id: input.bankAccountId, organisationId }, select: { companyId: true } });
    if (!account) throw new Error("Bank account not found.");
    if (input.companyId && account.companyId !== input.companyId) throw new Error("Bank account must belong to the selected company.");
  }
}

export async function issueInvoice(context: TenantContext, input: IssueInvoiceInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  return prisma.$transaction(
    async (tx) => {
      const draft = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organisationId: tenant.organisationId },
        include: { company: true, shippingAddress: true, billingAddress: true }
      });

      if (!draft) throw new Error("Invoice not found.");
      if (draft.status !== "draft") throw new Error("Only draft invoices can be issued.");
      if (draft.version !== input.expectedVersion) throw new Error("Invoice was changed elsewhere. Refresh and try again.");
      await assertDateNotLocked(tx, tenant.organisationId, draft.invoiceDate, "issue this invoice");

      if (draft.taxMode === "automatic") {
        if (!draft.company?.stateCode) {
          throw new Error("Add a state code to the company so GST can be worked out automatically, or pick a tax mode.");
        }
        if (!placeOfSupplyFor(draft)) {
          throw new Error("Set the place of supply (or a buyer address with a state code), or pick a tax mode.");
        }
      }

      await validateReferences(tx, tenant.organisationId, draft);
      await recalculateDraft(tx, draft.id, tenant.userId, { bumpVersion: false });

      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: draft.id },
        include: {
          company: true,
          buyer: true,
          consigneeBuyer: true,
          billingAddress: true,
          shippingAddress: true,
          bankAccount: true,
          items: { orderBy: { sortOrder: "asc" } }
        }
      });
      const requirements = draftIssueRequirements({
        status: invoice.status,
        companyId: invoice.companyId,
        buyerId: invoice.buyerId,
        itemCount: invoice.items.length,
        grandTotal: invoice.grandTotal
      });
      if (requirements.length > 0) throw new Error(`Before issuing: ${requirements.join(", ")}.`);

      const organisation = await tx.organisation.findUniqueOrThrow({
        where: { id: tenant.organisationId }
      });
      const series = await tx.invoiceNumberSeries.findFirst({
        where: { id: input.seriesId, organisationId: tenant.organisationId, isActive: true }
      });
      if (!series) throw new Error("Invoice number series not found.");

      const range = periodRangeForRule(series.resetRule, invoice.invoiceDate, organisation.financialYearStart);
      const used = await tx.invoice.aggregate({
        where: {
          seriesId: series.id,
          sequenceNumber: { not: null },
          ...(range ? { invoiceDate: { gte: range.start, lt: range.end } } : {})
        },
        _max: { sequenceNumber: true }
      });
      const plan = planSequence(series, invoice.invoiceDate, organisation.financialYearStart, used._max.sequenceNumber ?? null);
      let sequenceNumber = plan.sequence;
      const render = (sequence: number) => renderInvoiceNumber({
        pattern: series.pattern,
        prefix: series.prefix,
        sequence,
        date: invoice.invoiceDate,
        financialYearStartMonth: organisation.financialYearStart
      });
      let invoiceNumber = render(sequenceNumber);
      let numberAvailable = false;

      for (let attempt = 0; attempt < 100; attempt += 1) {
        const existingInvoice = await tx.invoice.findFirst({
          where: { organisationId: tenant.organisationId, invoiceNumber, NOT: { id: invoice.id } },
          select: { id: true }
        });
        const voidedNumber = await tx.invoiceNumberVoid.findFirst({
          where: { organisationId: tenant.organisationId, invoiceNumber },
          select: { id: true }
        });
        if (!existingInvoice && !voidedNumber) {
          numberAvailable = true;
          break;
        }

        sequenceNumber += 1;
        invoiceNumber = render(sequenceNumber);
      }
      if (!numberAvailable) {
        throw new Error("Could not allocate an unused invoice number. Check that the series pattern includes the sequence and the year.");
      }

      if (plan.advanceSeries) {
        await tx.invoiceNumberSeries.update({
          where: { id: series.id },
          data: { nextSequence: sequenceNumber + 1, lastResetKey: plan.resetKey }
        });
      }

      const effectiveTaxMode = resolveTaxMode(invoice.taxMode, {
        supplierStateCode: invoice.company?.stateCode,
        placeOfSupplyStateCode: placeOfSupplyFor(invoice)
      });
      const snapshot = buildInvoiceSnapshot(invoice, effectiveTaxMode);
      const issued = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "issued",
          seriesId: series.id,
          invoiceNumber,
          sequenceNumber,
          financialYear: financialYearLabel(invoice.invoiceDate, organisation.financialYearStart),
          companySnapshot: snapshot.company,
          buyerSnapshot: snapshot.buyer,
          consigneeSnapshot: snapshot.consignee,
          bankSnapshot: snapshot.bank,
          calculationSnapshot: snapshot.calculation,
          documentSnapshot: snapshot.document,
          paidTotal: new Prisma.Decimal(0),
          creditedTotal: new Prisma.Decimal(0),
          balanceDue: invoice.grandTotal,
          issuedById: tenant.userId,
          issuedAt: new Date(),
          updatedById: tenant.userId,
          version: { increment: 1 }
        }
      });

      await tx.invoiceRevision.create({
        data: {
          organisationId: tenant.organisationId,
          invoiceId: invoice.id,
          revisionNumber: 1,
          reason: "Initial issue",
          snapshot,
          createdById: tenant.userId
        }
      });

      await tx.generatedDocument.create({
        data: {
          organisationId: tenant.organisationId,
          invoiceId: invoice.id,
          documentType: "invoice_pdf",
          templateVersion: "a4-reference-v1",
          generatedById: tenant.userId
        }
      });

      await tx.auditLog.create({
        data: {
          organisationId: tenant.organisationId,
          actorUserId: tenant.userId,
          action: "invoice.issue",
          entityType: "invoice",
          entityId: invoice.id,
          metadata: { invoiceNumber, sequenceNumber, effectiveTaxMode }
        }
      });

      return issued;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cancelInvoice(context: TenantContext, input: CancelInvoiceInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:cancel");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, organisationId: tenant.organisationId },
      include: { items: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status !== "issued") throw new Error("Only issued invoices with no payments or credit notes can be cancelled.");
    if (invoice.paidTotal.gt(0)) throw new Error("Reverse the payments on this invoice before cancelling it.");
    const issuedCreditNotes = await tx.creditNote.count({
      where: { organisationId: tenant.organisationId, originalInvoiceId: invoice.id, status: "issued" }
    });
    if (issuedCreditNotes > 0 || invoice.creditedTotal.gt(0)) {
      throw new Error("This invoice has issued credit notes, so it cannot be cancelled.");
    }
    await assertDateNotLocked(tx, tenant.organisationId, invoice.invoiceDate, "cancel this invoice");

    const cancelled = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "cancelled",
        balanceDue: new Prisma.Decimal(0),
        cancelledById: tenant.userId,
        cancelledAt: new Date(),
        cancellationReason: input.reason,
        updatedById: tenant.userId,
        version: { increment: 1 }
      }
    });

    const lastRevision = await tx.invoiceRevision.aggregate({
      where: { invoiceId: invoice.id },
      _max: { revisionNumber: true }
    });
    await tx.invoiceRevision.create({
      data: {
        organisationId: tenant.organisationId,
        invoiceId: invoice.id,
        revisionNumber: (lastRevision._max.revisionNumber ?? 0) + 1,
        reason: `Cancelled: ${input.reason}`,
        snapshot: JSON.parse(JSON.stringify(invoice)),
        createdById: tenant.userId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice.cancel",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { reason: input.reason }
      }
    });

    return cancelled;
  });
}

export async function generateInvoicePdf(context: TenantContext, invoiceId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");
  assertPermission(tenant.role, "documents:download");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organisationId: tenant.organisationId },
    include: {
      company: { include: { logoAsset: true, signatureAsset: true } },
      buyer: true,
      consigneeBuyer: true,
      billingAddress: true,
      shippingAddress: true,
      bankAccount: true,
      items: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (!["issued", "partially_paid", "paid"].includes(invoice.status)) {
    throw new Error("Only issued invoices can be generated as PDF.");
  }
  if (!invoice.invoiceNumber) throw new Error("Issued invoice is missing its invoice number.");

  const [{ invoicePdfFilename, renderInvoicePdf }, { invoicePdfStorageKey, readPrivateDocument, writePrivateDocument }] = await Promise.all([
    import("@/lib/invoices/invoice-pdf"),
    import("@/lib/documents/document-storage")
  ]);
  const companyAssets = invoice.company as (typeof invoice.company & {
    logoAsset?: { storageKey: string; mimeType: string } | null;
    signatureAsset?: { storageKey: string; mimeType: string } | null;
  }) | null;
  const [logo, signature] = await Promise.all([
    companyAssets?.logoAsset ? readAssetForPdf(readPrivateDocument, companyAssets.logoAsset) : Promise.resolve(null),
    companyAssets?.signatureAsset ? readAssetForPdf(readPrivateDocument, companyAssets.signatureAsset) : Promise.resolve(null)
  ]);
  const pdfData = {
    ...buildInvoicePdfData(invoice),
    logo,
    signature
  };
  const buffer = await renderInvoicePdf(pdfData);
  const stored = await writePrivateDocument(
    invoicePdfStorageKey(tenant.organisationId, invoice.id),
    buffer
  );

  const document = await prisma.generatedDocument.create({
    data: {
      organisationId: tenant.organisationId,
      invoiceId: invoice.id,
      documentType: "invoice_pdf",
      templateVersion: "a4-reference-v1",
      storageKey: stored.storageKey,
      checksumSha256: stored.checksumSha256,
      generatedById: tenant.userId
    }
  });

  await prisma.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "invoice_pdf.generate",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: {
        documentId: document.id,
        storageKey: stored.storageKey,
        byteSize: stored.byteSize
      }
    }
  });

  return {
    buffer,
    filename: invoicePdfFilename(invoice.invoiceNumber),
    document
  };
}

function buildInvoiceSnapshot(invoice: InvoiceSnapshotSource, effectiveTaxMode: string) {
  return {
    company: invoice?.company ? JSON.parse(JSON.stringify(invoice.company)) : null,
    buyer: invoice?.buyer ? JSON.parse(JSON.stringify(invoice.buyer)) : null,
    consignee: {
      buyer: invoice?.consigneeBuyer ? JSON.parse(JSON.stringify(invoice.consigneeBuyer)) : null,
      billingAddress: invoice?.billingAddress ? JSON.parse(JSON.stringify(invoice.billingAddress)) : null,
      shippingAddress: invoice?.shippingAddress ? JSON.parse(JSON.stringify(invoice.shippingAddress)) : null
    },
    bank: invoice?.bankAccount ? JSON.parse(JSON.stringify(invoice.bankAccount)) : null,
    calculation: {
      subtotal: invoice?.subtotal.toString(),
      invoiceDiscount: invoice?.invoiceDiscount.toString(),
      otherCharges: invoice?.otherCharges.toString(),
      taxableTotal: invoice?.taxableTotal.toString(),
      igstTotal: invoice?.igstTotal.toString(),
      cgstTotal: invoice?.cgstTotal.toString(),
      sgstTotal: invoice?.sgstTotal.toString(),
      roundOff: invoice?.roundOff.toString(),
      grandTotal: invoice?.grandTotal.toString(),
      effectiveTaxMode,
      items: invoice?.items ? JSON.parse(JSON.stringify(invoice.items)) : []
    },
    document: {
      templateVersion: "a4-reference-v1",
      generatedFrom: "issued_snapshot"
    }
  };
}

function buildInvoicePdfData(invoice: InvoicePdfSource): InvoicePdfData {
  const company = asRecord(invoice.companySnapshot) ?? asRecord(invoice.company);
  const buyer = asRecord(invoice.buyerSnapshot) ?? asRecord(invoice.buyer);
  const consigneeSnapshot = asRecord(invoice.consigneeSnapshot);
  const bank = bankRecordForDocument(asRecord(invoice.bankSnapshot) ?? asRecord(invoice.bankAccount));
  const calculation = asRecord(invoice.calculationSnapshot);

  return {
    invoiceNumber: invoice.invoiceNumber || "invoice",
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    buyerOrderNumber: invoice.buyerOrderNumber,
    buyerOrderDate: invoice.buyerOrderDate,
    exporterReference: invoice.exporterReference,
    preCarriageBy: invoice.preCarriageBy,
    placeOfReceipt: invoice.placeOfReceipt,
    vesselFlightNo: invoice.vesselFlightNo,
    portOfLoading: invoice.portOfLoading,
    portOfDischarge: invoice.portOfDischarge,
    finalDestination: invoice.finalDestination,
    termsOfDelivery: invoice.termsOfDelivery,
    company,
    buyer,
    consignee: asRecord(consigneeSnapshot?.buyer) ?? asRecord(invoice.consigneeBuyer),
    billingAddress: asRecord(consigneeSnapshot?.billingAddress) ?? asRecord(invoice.billingAddress),
    shippingAddress: asRecord(consigneeSnapshot?.shippingAddress) ?? asRecord(invoice.shippingAddress),
    bank,
    lines: invoiceLinesFromSnapshot(calculation, invoice.items),
    totals: {
      subtotal: valueOrDecimal(calculation?.subtotal, invoice.subtotal),
      invoiceDiscount: valueOrDecimal(calculation?.invoiceDiscount, invoice.invoiceDiscount),
      otherCharges: valueOrDecimal(calculation?.otherCharges, invoice.otherCharges),
      taxableTotal: valueOrDecimal(calculation?.taxableTotal, invoice.taxableTotal),
      igstTotal: valueOrDecimal(calculation?.igstTotal, invoice.igstTotal),
      cgstTotal: valueOrDecimal(calculation?.cgstTotal, invoice.cgstTotal),
      sgstTotal: valueOrDecimal(calculation?.sgstTotal, invoice.sgstTotal),
      roundOff: valueOrDecimal(calculation?.roundOff, invoice.roundOff),
      grandTotal: valueOrDecimal(calculation?.grandTotal, invoice.grandTotal)
    },
    notes: invoice.notes,
    declaration: invoice.declaration
  };
}

function invoiceLinesFromSnapshot(
  calculation: Record<string, unknown> | null,
  fallbackLines: unknown[]
): InvoicePdfLine[] {
  const snapshotLines = Array.isArray(calculation?.items) ? calculation.items : fallbackLines;

  return snapshotLines.map((line, index) => {
    const record = asRecord(line) ?? {};
    return {
      sortOrder: numberValue(record.sortOrder, index + 1),
      description: stringValue(record.description, "-"),
      hsnSac: nullableString(record.hsnSac),
      sku: nullableString(record.sku),
      quantity: stringValue(record.quantity, "0"),
      unitCode: nullableString(record.unitCode),
      rate: stringValue(record.rate, "0"),
      taxableAmount: stringValue(record.taxableAmount, "0"),
      gstRate: stringValue(record.gstRate, "0"),
      igstAmount: stringValue(record.igstAmount, "0"),
      cgstAmount: stringValue(record.cgstAmount, "0"),
      sgstAmount: stringValue(record.sgstAmount, "0"),
      lineTotal: stringValue(record.lineTotal, "0")
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Logo and signature of a company for PDFs (production brand-assets flow). Missing files are skipped. */
export async function loadCompanyPdfAssets(organisationId: string, companyId: string | null) {
  if (!companyId) return { logo: null, signature: null };
  const company = await prisma.company.findFirst({
    where: { id: companyId, organisationId },
    include: { logoAsset: true, signatureAsset: true }
  });
  const { readPrivateDocument } = await import("@/lib/documents/document-storage");
  const [logo, signature] = await Promise.all([
    company?.logoAsset ? readAssetForPdf(readPrivateDocument, company.logoAsset) : Promise.resolve(null),
    company?.signatureAsset ? readAssetForPdf(readPrivateDocument, company.signatureAsset) : Promise.resolve(null)
  ]);
  return { logo, signature };
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

function valueOrDecimal(value: unknown, fallback: Prisma.Decimal): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback.toString();
}

function stringValue(value: unknown, fallback: string): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value instanceof Prisma.Decimal) return value.toString();
  return fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : Number(value || fallback);
}
