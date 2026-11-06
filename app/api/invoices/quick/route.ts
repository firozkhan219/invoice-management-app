import { prisma } from "@/lib/db/prisma";
import { FormError, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { addInvoiceItem, createInvoiceDraft, issueInvoice } from "@/lib/invoices/invoice-service";
import { invoiceDraftSchema, invoiceItemSchema } from "@/lib/validation/invoices";

/**
 * Quick invoice: creates a draft with all its lines in one step and, when asked,
 * issues it with the default number series. Advanced fields stay on the full editor.
 */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/invoices/new",
    handler: async ({ context, fields, formData }) => {
      const buyerId = typeof fields.buyerId === "string" ? fields.buyerId : "";
      if (!buyerId) throw new FormError("Choose a buyer.");

      const descriptions = formData.getAll("lineDescription").map(String);
      const lines = descriptions
        .map((description, index) => ({
          itemId: String(formData.getAll("lineItemId")[index] ?? ""),
          description: description.trim(),
          hsnSac: String(formData.getAll("lineHsn")[index] ?? ""),
          unitCode: String(formData.getAll("lineUnit")[index] ?? ""),
          quantity: String(formData.getAll("lineQuantity")[index] ?? ""),
          rate: String(formData.getAll("lineRate")[index] ?? ""),
          gstRate: String(formData.getAll("lineGst")[index] ?? "")
        }))
        .filter((line) => line.description || line.itemId);
      if (lines.length === 0) throw new FormError("Add at least one product.");

      // Use the buyer's default addresses so GST place of supply is known.
      const addresses = await prisma.buyerAddress.findMany({
        where: { organisationId: context.organisationId, buyerId, isActive: true },
        orderBy: { createdAt: "asc" }
      });
      const billing = addresses.find((address) => address.isBillingDefault) ?? addresses[0];
      const shipping = addresses.find((address) => address.isShippingDefault) ?? billing;

      const draftInput = parseForm(invoiceDraftSchema, {
        companyId: fields.companyId ?? "",
        buyerId,
        billingAddressId: billing?.id ?? "",
        shippingAddressId: shipping?.id ?? "",
        bankAccountId: fields.bankAccountId ?? "",
        invoiceDate: fields.invoiceDate ?? "",
        dueDate: fields.dueDate ?? "",
        currency: fields.currency || "INR",
        taxMode: fields.taxMode || "automatic",
        buyerOrderNumber: fields.buyerOrderNumber ?? "",
        notes: fields.notes ?? "",
        invoiceDiscount: "0",
        otherCharges: "0"
      });

      let invoice = await createInvoiceDraft(context, draftInput);
      try {
        for (const line of lines) {
          invoice = await addInvoiceItem(context, parseForm(invoiceItemSchema, {
            invoiceId: invoice.id,
            expectedVersion: String(invoice.version),
            itemId: line.itemId,
            description: line.description,
            hsnSac: line.hsnSac,
            unitCode: line.unitCode,
            quantity: line.quantity,
            rate: line.rate,
            gstRate: line.gstRate,
            discountAmount: "0"
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "A line could not be added.";
        return withFlash(`/invoices/${invoice.id}`, "error", `Draft saved, but a line needs attention: ${message}`);
      }

      if (fields.intent === "issue") {
        const series = await prisma.invoiceNumberSeries.findFirst({
          where: { organisationId: context.organisationId, isActive: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
        });
        if (!series) return withFlash(`/invoices/${invoice.id}`, "error", "Draft saved. Create an invoice number series in Settings to issue it.");
        try {
          await issueInvoice(context, { invoiceId: invoice.id, seriesId: series.id, expectedVersion: invoice.version });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The invoice could not be issued.";
          return withFlash(`/invoices/${invoice.id}`, "error", `Draft saved but not issued: ${message}`);
        }
        return withFlash(`/invoices/${invoice.id}`, "notice", "Invoice issued. Use Invoice PDF to download it.");
      }

      return withFlash(`/invoices/${invoice.id}`, "notice", "Draft saved.");
    }
  });
}
