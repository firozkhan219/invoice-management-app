import { updateCompany } from "@/lib/companies/company-service";
import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { COMPANY_CLEARABLE_FIELDS, companyUpdateSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      await updateCompany(context, parseForm(companyUpdateSchema, fields), blankKeys(fields, COMPANY_CLEARABLE_FIELDS));
      return withFlash("/companies", "notice", "Company updated.");
    }
  });
}
