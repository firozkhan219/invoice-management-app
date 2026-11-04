import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createCompany } from "@/lib/companies/company-service";
import { companySchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      await createCompany(context, parseForm(companySchema, fields));
      return "/companies";
    }
  });
}
