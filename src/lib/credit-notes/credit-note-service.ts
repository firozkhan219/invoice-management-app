import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateInvoiceTotals } from "@/lib/invoices/calculation";
import type { InvoicePdfData } from "@/lib/invoices/invoice-pdf";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { financialYearLabel } from "@/lib/settings/financial-year";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";
import type {
  CreditNoteDraftInput,
  CreditNoteIssueInput,
  CreditNoteLineDeleteInput,
  CreditNoteLineInput,
  CreditNoteNumberSeriesInput,
  CreditNoteUpdateInput
} from "@/lib/validation/credit-notes";

const CREDIT_NOTE_ALLOWED_ORIGINAL_STATUSES = ["issued", "partially_paid", "paid"] as const;

export function canCreateCreditNoteForInvoice(status: string): boolean {
  return CREDIT_NOTE_ALLOWED_ORIGINAL_STATUSES.includes(status as typeof CREDIT_NOTE_ALLOWED_ORIGINAL_STATUSES[number]);
}

export async function listCreditNotes(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");

  return prisma.creditNote.findMany({
    where: { organisationId: tenant.organisationId },
    include: { originalInvoice: { include: { buyer: true, company: true } }, lines: true },
    orderBy: [{ creditNoteDate: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCreditNote(context: TenantContext, creditNoteId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");

  return prisma.creditNote.findFirst({
    where: { id: creditNoteId, organisationId: tenant.organisationId },
    include: {
      originalInvoice: {
        include: {
          company: true,
          buyer: true,
          consigneeBuyer: true,
          billingAddress: true,
          shippingAddress: true,
          bankAccount: true,
          items: { orderBy: { sortOrder: "asc" } }
        }
      },
      lines: { include: { invoiceItem: true }, orderBy: { sortOrder: "asc" } },
      series: true,
      createdBy: true,
      updatedBy: true,
      issuedBy: true
    }
  });
}

export async function getCreditNoteWorkspace(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  const organisation = await prisma.organisation.findUniqueOrThrow({ where: { id: tenant.organisationId } });
  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: { legalName: "asc" }
  });
  const series = await prisma.creditNoteNumberSeries.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });

  return { organisation, companies, series };
}

export async function createCreditNoteDraft(context: TenantContext, input: CreditNoteDraftInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.originalInvoiceId, organisationId: tenant.organisationId },
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

    if (!invoice) throw new Error("Invoice not found.");
    if (!canCreateCreditNoteForInvoice(invoice.status)) {
      throw new Error("Credit notes can only be created for issued, partially paid, or paid invoices.");
    }

    const creditNote = await tx.creditNote.create({
      data: {
        organisationId: tenant.organisationId,
        originalInvoiceId: invoice.id,
        creditNoteDate: new Date(),
        reason: input.reason,
        currency: invoice.currency,
        originalInvoiceSnapshot: JSON.parse(JSON.stringify(invoice)),
        createdById: tenant.userId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "credit_note_draft.create",
        entityType: "credit_note",
        entityId: creditNote.id,
        metadata: {
          originalInvoiceId: invoice.id,
          originalInvoiceNumber: invoice.invoiceNumber
        }
      }
    });

    return creditNote;
  });
}

export async function updateCreditNoteDraft(context: TenantContext, input: CreditNoteUpdateInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  const creditNote = await prisma.creditNote.findFirst({
    where: { id: input.creditNoteId, organisationId: tenant.organisationId }
  });
  if (!creditNote) throw new Error("Credit note not found.");
  if (creditNote.status !== "draft") throw new Error("Only draft credit notes can be edited.");

  const updated = await prisma.creditNote.update({
    where: { id: creditNote.id },
    data: {
      creditNoteDate: input.creditNoteDate,
      reason: input.reason,
      updatedById: tenant.userId
    }
  });

  await prisma.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "credit_note_draft.update",
      entityType: "credit_note",
      entityId: creditNote.id
    }
  });

  return updated;
}

export async function addCreditNoteLine(context: TenantContext, input: CreditNoteLineInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const creditNote = await tx.creditNote.findFirst({
      where: { id: input.creditNoteId, organisationId: tenant.organisationId },
      include: { originalInvoice: { include: { items: true } }, lines: true }
    });
    if (!creditNote) throw new Error("Credit note not found.");
    if (creditNote.status !== "draft") throw new Error("Only draft credit note lines can be edited.");

    const sourceLine = creditNote.originalInvoice.items.find((line) => line.id === input.invoiceItemId);
    if (!sourceLine) throw new Error("Original invoice line not found.");

    const sortOrder = creditNote.lines.length + 1;
    const lineTotals = calculateInvoiceTotals([{ ...input, gstRate: sourceLine.gstRate }], creditNote.originalInvoice.taxMode).lines[0];
    await tx.creditNoteLine.create({
      data: {
        organisationId: tenant.organisationId,
        creditNoteId: creditNote.id,
        invoiceItemId: sourceLine.id,
        sortOrder,
        sku: sourceLine.sku,
        description: sourceLine.description,
        hsnSac: sourceLine.hsnSac,
        quantity: new Prisma.Decimal(input.quantity),
        unitCode: sourceLine.unitCode,
        rate: new Prisma.Decimal(input.rate),
        discountAmount: new Prisma.Decimal(input.discountAmount),
        taxableAmount: lineTotals.taxableAmount,
        gstRate: sourceLine.gstRate,
        igstAmount: lineTotals.igstAmount,
        cgstAmount: lineTotals.cgstAmount,
        sgstAmount: lineTotals.sgstAmount,
        lineTotal: lineTotals.lineTotal
      }
    });

    const updated = await recalculateCreditNoteTotals(tx, creditNote.id, tenant.organisationId, tenant.userId);
    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "credit_note_line.create",
        entityType: "credit_note",
        entityId: creditNote.id,
        metadata: { invoiceItemId: sourceLine.id }
      }
    });

    return updated;
  });
}

export async function deleteCreditNoteLine(context: TenantContext, input: CreditNoteLineDeleteInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:create");

  return prisma.$transaction(async (tx) => {
    const creditNote = await tx.creditNote.findFirst({
      where: { id: input.creditNoteId, organisationId: tenant.organisationId },
      include: { lines: true }
    });
    if (!creditNote) throw new Error("Credit note not found.");
    if (creditNote.status !== "draft") throw new Error("Only draft credit note lines can be deleted.");

    const line = creditNote.lines.find((item) => item.id === input.lineId);
    if (!line) throw new Error("Credit note line not found.");

    await tx.creditNoteLine.delete({ where: { id: line.id } });
    const updated = await recalculateCreditNoteTotals(tx, creditNote.id, tenant.organisationId, tenant.userId);
    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "credit_note_line.delete",
        entityType: "credit_note",
        entityId: creditNote.id,
        metadata: { lineId: line.id }
      }
    });

    return updated;
  });
}

export async function issueCreditNote(context: TenantContext, input: CreditNoteIssueInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  return prisma.$transaction(
    async (tx) => {
      const creditNote = await tx.creditNote.findFirst({
        where: { id: input.creditNoteId, organisationId: tenant.organisationId },
        include: { originalInvoice: true, lines: true }
      });
      if (!creditNote) throw new Error("Credit note not found.");
      if (creditNote.status !== "draft") throw new Error("Only draft credit notes can be issued.");
      if (!canCreateCreditNoteForInvoice(creditNote.originalInvoice.status)) {
        throw new Error("Credit notes can only be issued for issued, partially paid, or paid invoices.");
      }
      if (creditNote.lines.length === 0 || creditNote.grandTotal.lte(0)) {
        throw new Error("Add at least one positive credit line before issuing.");
      }

      const organisation = await tx.organisation.findUniqueOrThrow({ where: { id: tenant.organisationId } });
      const series = await tx.creditNoteNumberSeries.findFirst({
        where: { id: input.seriesId, organisationId: tenant.organisationId, isActive: true }
      });
      if (!series) throw new Error("Credit note number series not found.");

      const resetKey = resetKeyForRule(series.resetRule, creditNote.creditNoteDate, organisation.financialYearStart);
      const shouldReset = resetKey !== null && series.lastResetKey !== resetKey;
      let sequenceNumber = shouldReset ? series.startingNumber : series.nextSequence;
      let creditNoteNumber = renderInvoiceNumber({
        pattern: series.pattern,
        prefix: series.prefix,
        sequence: sequenceNumber,
        date: creditNote.creditNoteDate,
        financialYearStartMonth: organisation.financialYearStart
      });
      let numberAvailable = false;

      for (let attempt = 0; attempt < 100; attempt += 1) {
        const exists = await tx.creditNote.findFirst({
          where: { organisationId: tenant.organisationId, creditNoteNumber, NOT: { id: creditNote.id } },
          select: { id: true }
        });
        if (!exists) {
          numberAvailable = true;
          break;
        }
        sequenceNumber += 1;
        creditNoteNumber = renderInvoiceNumber({
          pattern: series.pattern,
          prefix: series.prefix,
          sequence: sequenceNumber,
          date: creditNote.creditNoteDate,
          financialYearStartMonth: organisation.financialYearStart
        });
      }
      if (!numberAvailable) throw new Error("Could not allocate an unused credit note number.");

      await tx.creditNoteNumberSeries.update({
        where: { id: series.id },
        data: { nextSequence: sequenceNumber + 1, lastResetKey: resetKey }
      });

      const issued = await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: "issued",
          seriesId: series.id,
          creditNoteNumber,
          sequenceNumber,
          financialYear: financialYearLabel(creditNote.creditNoteDate, organisation.financialYearStart),
          issuedById: tenant.userId,
          issuedAt: new Date(),
          updatedById: tenant.userId
        }
      });

      await tx.auditLog.create({
        data: {
          organisationId: tenant.organisationId,
          actorUserId: tenant.userId,
          action: "credit_note.issue",
          entityType: "credit_note",
          entityId: creditNote.id,
          metadata: { creditNoteNumber, sequenceNumber, originalInvoiceId: creditNote.originalInvoiceId }
        }
      });

      return issued;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function createCreditNoteNumberSeries(context: TenantContext, input: CreditNoteNumberSeriesInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  return prisma.$transaction(async (tx) => {
    if (input.companyId) {
      const company = await tx.company.count({ where: { id: input.companyId, organisationId: tenant.organisationId } });
      if (!company) throw new Error("Company not found.");
    }
    if (input.isDefault) {
      await tx.creditNoteNumberSeries.updateMany({
        where: { organisationId: tenant.organisationId, companyId: input.companyId ?? null },
        data: { isDefault: false }
      });
    }

    const series = await tx.creditNoteNumberSeries.create({
      data: {
        ...input,
        organisationId: tenant.organisationId,
        nextSequence: input.startingNumber
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "credit_note_number_series.create",
        entityType: "credit_note_number_series",
        entityId: series.id
      }
    });

    return series;
  });
}

export async function generateCreditNotePdf(context: TenantContext, creditNoteId: string) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:read");
  assertPermission(tenant.role, "documents:download");

  const creditNote = await getCreditNote(context, creditNoteId);
  if (!creditNote) throw new Error("Credit note not found.");
  if (creditNote.status !== "issued") throw new Error("Only issued credit notes can be generated as PDF.");
  if (!creditNote.creditNoteNumber) throw new Error("Issued credit note is missing its number.");

  const [{ invoicePdfFilename, renderInvoicePdf }, { creditNotePdfStorageKey, writePrivateDocument }] = await Promise.all([
    import("@/lib/invoices/invoice-pdf"),
    import("@/lib/documents/document-storage")
  ]);
  const pdfData = buildCreditNotePdfData(creditNote);
  const buffer = await renderInvoicePdf(pdfData);
  const stored = await writePrivateDocument(
    creditNotePdfStorageKey(tenant.organisationId, creditNote.id),
    buffer
  );

  const document = await prisma.generatedDocument.create({
    data: {
      organisationId: tenant.organisationId,
      invoiceId: creditNote.originalInvoiceId,
      creditNoteId: creditNote.id,
      documentType: "credit_note_pdf",
      templateVersion: "a4-credit-note-v1",
      storageKey: stored.storageKey,
      checksumSha256: stored.checksumSha256,
      generatedById: tenant.userId
    }
  });

  await prisma.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "credit_note_pdf.generate",
      entityType: "credit_note",
      entityId: creditNote.id,
      metadata: { documentId: document.id, storageKey: stored.storageKey, byteSize: stored.byteSize }
    }
  });

  return { buffer, filename: invoicePdfFilename(creditNote.creditNoteNumber), document };
}

async function recalculateCreditNoteTotals(
  tx: Prisma.TransactionClient,
  creditNoteId: string,
  organisationId: string,
  userId: string
) {
  const creditNote = await tx.creditNote.findFirstOrThrow({
    where: { id: creditNoteId, organisationId },
    include: { originalInvoice: true, lines: true }
  });
  const totals = calculateInvoiceTotals(creditNote.lines, creditNote.originalInvoice.taxMode);

  return tx.creditNote.update({
    where: { id: creditNote.id },
    data: {
      subtotal: totals.subtotal,
      taxableTotal: totals.taxableTotal,
      igstTotal: totals.igstTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      updatedById: userId
    }
  });
}

function buildCreditNotePdfData(creditNote: NonNullable<Awaited<ReturnType<typeof getCreditNote>>>): InvoicePdfData {
  const original = creditNote.originalInvoice;

  return {
    documentTitle: "Credit Note",
    originalInvoiceNumber: original.invoiceNumber,
    originalInvoiceDate: original.invoiceDate,
    invoiceNumber: creditNote.creditNoteNumber || "credit-note",
    invoiceDate: creditNote.creditNoteDate,
    dueDate: null,
    currency: creditNote.currency,
    buyerOrderNumber: original.buyerOrderNumber,
    buyerOrderDate: original.buyerOrderDate,
    exporterReference: original.exporterReference,
    preCarriageBy: original.preCarriageBy,
    placeOfReceipt: original.placeOfReceipt,
    vesselFlightNo: original.vesselFlightNo,
    portOfLoading: original.portOfLoading,
    portOfDischarge: original.portOfDischarge,
    finalDestination: original.finalDestination,
    termsOfDelivery: original.termsOfDelivery,
    company: asRecord(original.companySnapshot) ?? asRecord(original.company),
    buyer: asRecord(original.buyerSnapshot) ?? asRecord(original.buyer),
    consignee: asRecord(asRecord(original.consigneeSnapshot)?.buyer) ?? asRecord(original.consigneeBuyer),
    billingAddress: asRecord(asRecord(original.consigneeSnapshot)?.billingAddress) ?? asRecord(original.billingAddress),
    shippingAddress: asRecord(asRecord(original.consigneeSnapshot)?.shippingAddress) ?? asRecord(original.shippingAddress),
    bank: asRecord(original.bankSnapshot) ?? asRecord(original.bankAccount),
    lines: creditNote.lines.map((line) => ({
      sortOrder: line.sortOrder,
      description: line.description,
      hsnSac: line.hsnSac,
      sku: line.sku,
      quantity: line.quantity.toString(),
      unitCode: line.unitCode,
      rate: line.rate.toString(),
      taxableAmount: line.taxableAmount.toString(),
      gstRate: line.gstRate.toString(),
      igstAmount: line.igstAmount.toString(),
      cgstAmount: line.cgstAmount.toString(),
      sgstAmount: line.sgstAmount.toString(),
      lineTotal: line.lineTotal.toString()
    })),
    totals: {
      subtotal: creditNote.subtotal.toString(),
      invoiceDiscount: "0",
      otherCharges: "0",
      taxableTotal: creditNote.taxableTotal.toString(),
      igstTotal: creditNote.igstTotal.toString(),
      cgstTotal: creditNote.cgstTotal.toString(),
      sgstTotal: creditNote.sgstTotal.toString(),
      roundOff: creditNote.roundOff.toString(),
      grandTotal: creditNote.grandTotal.toString()
    },
    notes: creditNote.reason || `Against invoice ${original.invoiceNumber || original.id}`,
    declaration: `This credit note is issued against invoice ${original.invoiceNumber || original.id} dated ${original.invoiceDate.toISOString().slice(0, 10)}.`
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
