import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { upsertOrganisationSettings } from "@/lib/settings/settings-service";
import { organisationSettingsSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings",
    handler: async ({ context, fields }) => {
      await upsertOrganisationSettings(context, parseForm(organisationSettingsSchema, fields));
      return withFlash("/settings", "notice", "Settings saved.");
    }
  });
}
