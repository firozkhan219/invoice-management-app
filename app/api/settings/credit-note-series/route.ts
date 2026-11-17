import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { createCreditNoteNumberSeries } from "@/lib/credit-notes/credit-note-service";
import { updateNumberSeriesAction } from "@/lib/settings/settings-service";
import { numberSeriesActionSchema } from "@/lib/validation/settings";
import { creditNoteNumberSeriesSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings?tab=credit-note-numbering",
    handler: async ({ context, fields }) => {
      if (typeof fields.action === "string" && fields.action) {
        await updateNumberSeriesAction(context, parseForm(numberSeriesActionSchema, { ...fields, kind: "credit_note" }));
      } else {
        await createCreditNoteNumberSeries(context, parseForm(creditNoteNumberSeriesSchema, fields));
      }
      return withFlash("/settings?tab=credit-note-numbering", "notice", "Saved.");
    }
  });
}
