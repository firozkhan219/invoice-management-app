import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { cancelInvoice } from "@/lib/invoices/invoice-service";
import { cancelInvoiceSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(cancelInvoiceSchema, fields);
      await cancelInvoice(context, input);
      return `/invoices/${input.invoiceId}`;
    }
  });
}
