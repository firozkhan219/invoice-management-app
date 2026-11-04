import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createBankAccount } from "@/lib/companies/company-service";
import { bankAccountSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      await createBankAccount(context, parseForm(bankAccountSchema, fields));
      return "/companies";
    }
  });
}
