import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { updateOrganisationProfile, upsertOrganisationSettings } from "@/lib/settings/settings-service";
import { CLEARABLE_SETTINGS_FIELDS, organisationProfileSchema, organisationSettingsSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings?tab=general",
    handler: async ({ context, fields }) => {
      if (fields.section === "organisation") {
        await updateOrganisationProfile(context, parseForm(organisationProfileSchema, fields));
        return withFlash("/settings?tab=general", "notice", "Organisation details saved.");
      }
      await upsertOrganisationSettings(
        context,
        parseForm(organisationSettingsSchema, fields),
        blankKeys(fields, CLEARABLE_SETTINGS_FIELDS)
      );
      return withFlash("/settings?tab=general", "notice", "Settings saved.");
    }
  });
}
