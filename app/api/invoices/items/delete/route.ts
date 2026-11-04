import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { deleteInvoiceItem } from "@/lib/invoices/invoice-service";
import { invoiceItemDeleteSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(invoiceItemDeleteSchema, fields);
      await deleteInvoiceItem(context, input);
      return `/invoices/${input.invoiceId}`;
    }
  });
}
