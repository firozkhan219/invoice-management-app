import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { updateInvoiceItem } from "@/lib/invoices/invoice-service";
import { invoiceItemUpdateSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(invoiceItemUpdateSchema, fields);
      await updateInvoiceItem(context, input);
      return `/invoices/${input.invoiceId}`;
    }
  });
}
