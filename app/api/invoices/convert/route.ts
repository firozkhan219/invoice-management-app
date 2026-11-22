import { handleTenantForm, idPath, withFlash } from "@/lib/http/form";
import { convertProformaToInvoice } from "@/lib/invoices/invoice-service";

/** Creates a tax invoice draft from an issued proforma. */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.invoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const proformaId = typeof fields.invoiceId === "string" ? fields.invoiceId : "";
      const invoice = await convertProformaToInvoice(context, proformaId);
      return withFlash(`/invoices/${invoice.id}`, "notice", "Tax invoice draft created from the proforma. Check it, then issue it.");
    }
  });
}
