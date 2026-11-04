import { updateCompany } from "@/lib/companies/company-service";
import { isUploadedFile } from "@/lib/files/file-assets";
import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { COMPANY_CLEARABLE_FIELDS, companyUpdateSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields, formData }) => {
      const input = parseForm(companyUpdateSchema, fields);
      const logo = formData.get("logo");
      const signature = formData.get("signature");
      await updateCompany(context, input, blankKeys(fields, COMPANY_CLEARABLE_FIELDS), {
        logo: isUploadedFile(logo) ? logo : undefined,
        signature: isUploadedFile(signature) ? signature : undefined
      });
      return withFlash("/companies", "notice", "Company updated.");
    }
  });
}
