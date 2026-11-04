import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { addInvoiceItem } from "@/lib/invoices/invoice-service";
import { invoiceItemSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(invoiceItemSchema, fields);
      await addInvoiceItem(context, input);
      return `/invoices/${input.invoiceId}`;
    }
  });
}
