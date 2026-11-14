import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { uploadItemImage } from "@/lib/items/item-service";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, formData }) => {
      const itemId = formData.get("itemId");
      const file = formData.get("file");

      if (typeof itemId !== "string" || !itemId) {
        throw new FormError("Choose an item before uploading an image.");
      }
      if (!(file instanceof File) || file.size === 0) {
        throw new FormError("Choose a PNG, JPEG, or WebP image to upload.");
      }

      await uploadItemImage(context, { itemId, file });
      return withFlash("/items", "notice", "Product image uploaded.");
    }
  });
}
