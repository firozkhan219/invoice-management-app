import { handleTenantForm, idPath, parseForm, withFlash } from "@/lib/http/form";
import { updatePackingListLine } from "@/lib/packing-lists/packing-list-service";
import { packingListLineUpdateSchema } from "@/lib/validation/packing-lists";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/packing-lists", fields.packingListId, "/packing-lists"),
    handler: async ({ context, fields }) => {
      const input = parseForm(packingListLineUpdateSchema, fields);
      await updatePackingListLine(context, input);
      return withFlash(`/packing-lists/${input.packingListId}`, "notice", "Line updated.");
    }
  });
}
