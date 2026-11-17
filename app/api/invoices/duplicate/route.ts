import { handleTenantForm, idPath, withFlash } from "@/lib/http/form";
import { duplicateInvoice } from "@/lib/invoices/invoice-service";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const invoiceId = typeof fields.invoiceId === "string" ? fields.invoiceId : "";
      const invoice = await duplicateInvoice(context, invoiceId);
      return withFlash(`/invoices/${invoice.id}`, "notice", "Copied into a new draft dated today. Check it, then issue it.");
    }
  });
}
