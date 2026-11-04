import { deleteCreditNoteLine } from "@/lib/credit-notes/credit-note-service";
import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { creditNoteLineDeleteSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/credit-notes", fields.creditNoteId, "/credit-notes"),
    handler: async ({ context, fields }) => {
      const input = parseForm(creditNoteLineDeleteSchema, fields);
      await deleteCreditNoteLine(context, input);
      return `/credit-notes/${input.creditNoteId}`;
    }
  });
}
