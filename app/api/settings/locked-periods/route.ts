import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createLockedPeriod } from "@/lib/settings/settings-service";
import { lockedPeriodSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings",
    handler: async ({ context, fields }) => {
      await createLockedPeriod(context, parseForm(lockedPeriodSchema, fields));
      return "/settings";
    }
  });
}
