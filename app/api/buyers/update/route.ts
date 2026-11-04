import { updateBuyer } from "@/lib/buyers/buyer-service";
import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { BUYER_CLEARABLE_FIELDS, buyerUpdateSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/buyers",
    handler: async ({ context, fields }) => {
      await updateBuyer(context, parseForm(buyerUpdateSchema, fields), blankKeys(fields, BUYER_CLEARABLE_FIELDS));
      return withFlash("/buyers", "notice", "Buyer updated.");
    }
  });
}
