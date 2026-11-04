import { blankKeys, handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { CLEARABLE_DRAFT_FIELDS, createInvoiceDraft, updateInvoiceDraft } from "@/lib/invoices/invoice-service";
import { invoiceDraftSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices/new"),
    handler: async ({ context, fields }) => {
      const invoiceId = typeof fields.invoiceId === "string" && fields.invoiceId ? fields.invoiceId : undefined;
      const { invoiceId: _ignored, ...draftFields } = fields;
      void _ignored;
      const input = parseForm(invoiceDraftSchema, draftFields);

      const invoice = invoiceId
        ? await updateInvoiceDraft(context, invoiceId, input, blankKeys(draftFields, CLEARABLE_DRAFT_FIELDS))
        : await createInvoiceDraft(context, input);

      return `/invoices/${invoice.id}`;
    }
  });
}
