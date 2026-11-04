import { updateBuyerAddress } from "@/lib/buyers/buyer-service";
import { blankKeys, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { BUYER_ADDRESS_CLEARABLE_FIELDS, buyerAddressUpdateSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/buyers",
    handler: async ({ context, fields }) => {
      await updateBuyerAddress(context, parseForm(buyerAddressUpdateSchema, fields), blankKeys(fields, BUYER_ADDRESS_CLEARABLE_FIELDS));
      return withFlash("/buyers", "notice", "Address updated.");
    }
  });
}
