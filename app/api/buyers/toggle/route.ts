import { setBuyerMasterActive } from "@/lib/buyers/buyer-service";
import { handleTenantForm, parseForm } from "@/lib/http/form";
import { buyerToggleSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/buyers",
    handler: async ({ context, fields }) => {
      await setBuyerMasterActive(context, parseForm(buyerToggleSchema, fields));
      return "/buyers";
    }
  });
}
