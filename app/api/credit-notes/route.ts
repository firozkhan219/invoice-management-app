import { createCreditNoteDraft } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { creditNoteDraftSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/invoices", fields.originalInvoiceId, "/invoices"),
    handler: async ({ context, fields }) => {
      const creditNote = await createCreditNoteDraft(context, parseForm(creditNoteDraftSchema, fields));
      return `/credit-notes/${creditNote.id}`;
    }
  });
}
