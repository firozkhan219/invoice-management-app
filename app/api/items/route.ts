import { handleTenantForm, parseForm } from "@/lib/http/form";
import { createItem } from "@/lib/items/item-service";
import { itemSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await createItem(context, parseForm(itemSchema, fields));
      return "/items";
    }
  });
}
