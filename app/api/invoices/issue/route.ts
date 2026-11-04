import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { issueInvoice } from "@/lib/invoices/invoice-service";
import { issueInvoiceSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const input = parseForm(issueInvoiceSchema, fields);
      await issueInvoice(context, input);
      return `/invoices/${input.invoiceId}`;
    }
  });
}
