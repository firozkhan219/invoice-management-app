import { handleTenantForm, idPath, parseForm, withFlash } from "@/lib/http/form";
import { deleteDraftInvoice } from "@/lib/invoices/invoice-service";
import { deleteDraftInvoiceSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      await deleteDraftInvoice(context, parseForm(deleteDraftInvoiceSchema, fields));
      return withFlash("/invoices", "notice", "Draft deleted.");
    }
  });
}
