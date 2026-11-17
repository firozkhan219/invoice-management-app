import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { createLockedPeriod, updateLockedPeriodAction } from "@/lib/settings/settings-service";
import { lockedPeriodActionSchema, lockedPeriodSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings?tab=locked-periods",
    handler: async ({ context, fields }) => {
      if (typeof fields.action === "string" && fields.action) {
        await updateLockedPeriodAction(context, parseForm(lockedPeriodActionSchema, fields));
      } else {
        await createLockedPeriod(context, parseForm(lockedPeriodSchema, fields));
      }
      return withFlash("/settings?tab=locked-periods", "notice", "Saved.");
    }
  });
}
