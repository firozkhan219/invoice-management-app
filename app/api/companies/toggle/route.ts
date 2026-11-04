import { setCompanyMasterActive } from "@/lib/companies/company-service";
import { handleTenantForm, parseForm } from "@/lib/http/form";
import { companyToggleSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      await setCompanyMasterActive(context, parseForm(companyToggleSchema, fields));
      return "/companies";
    }
  });
}
