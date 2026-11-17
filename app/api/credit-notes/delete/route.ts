import { deleteCreditNoteDraft } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm, withFlash } from "@/lib/http/form";
import { creditNoteDeleteSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/credit-notes", fields.creditNoteId, "/credit-notes"),
    handler: async ({ context, fields }) => {
      const input = parseForm(creditNoteDeleteSchema, fields);
      const deleted = await deleteCreditNoteDraft(context, input);
      return withFlash(`/invoices/${deleted.originalInvoiceId}`, "notice", "Credit note draft deleted.");
    }
  });
}
