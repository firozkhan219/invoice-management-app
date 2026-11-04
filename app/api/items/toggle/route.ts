import { handleTenantForm, parseForm } from "@/lib/http/form";
import { setItemMasterActive } from "@/lib/items/item-service";
import { itemToggleSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, fields }) => {
      await setItemMasterActive(context, parseForm(itemToggleSchema, fields));
      return "/items";
    }
  });
}
