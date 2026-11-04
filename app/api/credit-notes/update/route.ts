import { updateCreditNoteDraft } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { creditNoteUpdateSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/credit-notes", fields.creditNoteId, "/credit-notes"),
    handler: async ({ context, fields }) => {
      const input = parseForm(creditNoteUpdateSchema, fields);
      await updateCreditNoteDraft(context, input);
      return `/credit-notes/${input.creditNoteId}`;
    }
  });
}
