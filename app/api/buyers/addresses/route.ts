import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createBuyerAddress } from "@/lib/buyers/buyer-service";
import { buyerAddressSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/buyers",
    handler: async ({ context, fields }) => {
      await createBuyerAddress(context, parseForm(buyerAddressSchema, fields));
      return "/buyers";
    }
  });
}
