import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { uploadBulkItemImages } from "@/lib/items/item-service";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, formData }) => {
      const files = formData
        .getAll("files")
        .filter((file): file is File => file instanceof File && file.size > 0);

      if (files.length === 0) {
        throw new FormError("Choose one or more product images to upload.");
      }

      const result = await uploadBulkItemImages(context, files);
      const message = `${result.linked} image${result.linked === 1 ? "" : "s"} linked${
        result.unmatched.length ? `, ${result.unmatched.length} unmatched (${result.unmatched.slice(0, 5).join(", ")})` : ""
      }.`;
      return withFlash("/items", result.linked ? "notice" : "error", message);
    }
  });
}
