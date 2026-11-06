import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { deleteItem } from "@/lib/items/item-service";
import { itemActionSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await deleteItem(context, parseForm(itemActionSchema, fields));
      return withFlash("/items", "notice", "Item deleted.");
    }
  });
}
