import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createNumberSeries, updateNumberSeriesAction } from "@/lib/settings/settings-service";
import { numberSeriesActionSchema, numberSeriesSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings",
    handler: async ({ context, fields }) => {
      if (typeof fields.action === "string" && fields.action) {
        await updateNumberSeriesAction(context, parseForm(numberSeriesActionSchema, fields));
      } else {
        await createNumberSeries(context, parseForm(numberSeriesSchema, fields));
      }
      return "/settings";
    }
  });
}
