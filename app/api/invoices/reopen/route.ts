import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { reopenInvoiceForEditing } from "@/lib/invoices/invoice-service";
import { reopenInvoiceSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(reopenInvoiceSchema, fields);
      await reopenInvoiceForEditing(context, input);
      // The page itself explains that the invoice is open for editing and keeps its number.
      return `/invoices/${input.invoiceId}?edit=1#edit-invoice`;
    }
  });
}
