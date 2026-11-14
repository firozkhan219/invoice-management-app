import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { deleteItems } from "@/lib/items/item-service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, formData }) => {
      const itemIds = formData.getAll("itemIds").filter((id): id is string => typeof id === "string" && uuid.test(id));
      if (itemIds.length === 0) throw new FormError("Select at least one product to delete.");

      const { deleted } = await deleteItems(context, itemIds);
      return withFlash("/items", "notice", `${deleted} product${deleted === 1 ? "" : "s"} deleted.`);
    }
  });
}
