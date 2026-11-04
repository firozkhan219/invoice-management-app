import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createUnit } from "@/lib/items/item-service";
import { unitSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await createUnit(context, parseForm(unitSchema, fields));
      return "/items";
    }
  });
}
