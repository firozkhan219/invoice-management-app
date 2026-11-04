import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createBuyer } from "@/lib/buyers/buyer-service";
import { buyerSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/buyers",
    handler: async ({ context, fields }) => {
      await createBuyer(context, parseForm(buyerSchema, fields));
      return "/buyers";
    }
  });
}
