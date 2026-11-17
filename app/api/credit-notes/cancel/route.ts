import { cancelCreditNote } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm, withFlash } from "@/lib/http/form";
import { creditNoteCancelSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/credit-notes", fields.creditNoteId, "/credit-notes"),
    handler: async ({ context, fields }) => {
      const input = parseForm(creditNoteCancelSchema, fields);
      await cancelCreditNote(context, input);
      return withFlash(`/credit-notes/${input.creditNoteId}`, "notice", "Credit note cancelled. The invoice balance has been restored.");
    }
  });
}
