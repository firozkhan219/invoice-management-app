import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createTaxRate } from "@/lib/items/item-service";
import { taxRateSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await createTaxRate(context, parseForm(taxRateSchema, fields));
      return "/items";
    }
  });
}
