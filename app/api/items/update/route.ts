import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { updateItem } from "@/lib/items/item-service";
import { itemUpdateSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await updateItem(context, parseForm(itemUpdateSchema, fields));
      return withFlash("/items", "notice", "Item updated.");
    }
  });
}
