import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createCreditNoteNumberSeries } from "@/lib/credit-notes/credit-note-service";
import { creditNoteNumberSeriesSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings",
    handler: async ({ context, fields }) => {
      await createCreditNoteNumberSeries(context, parseForm(creditNoteNumberSeriesSchema, fields));
      return "/settings";
    }
  });
}
