import { addCreditNoteLine } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { creditNoteLineSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/credit-notes", fields.creditNoteId, "/credit-notes"),
    handler: async ({ context, fields }) => {
      const input = parseForm(creditNoteLineSchema, fields);
      await addCreditNoteLine(context, input);
      return `/credit-notes/${input.creditNoteId}`;
    }
  });
}
