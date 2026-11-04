import { updateBankAccount } from "@/lib/companies/company-service";
import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { BANK_ACCOUNT_CLEARABLE_FIELDS, bankAccountUpdateSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      await updateBankAccount(context, parseForm(bankAccountUpdateSchema, fields), blankKeys(fields, BANK_ACCOUNT_CLEARABLE_FIELDS));
      return withFlash("/companies", "notice", "Bank account updated.");
    }
  });
}
