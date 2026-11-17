import { handleTenantForm, idPath, parseForm, withFlash } from "@/lib/http/form";
import { reopenPackingList } from "@/lib/packing-lists/packing-list-service";
import { packingListStatusSchema } from "@/lib/validation/packing-lists";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/packing-lists", fields.packingListId, "/packing-lists"),
    handler: async ({ context, fields }) => {
      const input = parseForm(packingListStatusSchema, fields);
      await reopenPackingList(context, input);
      return withFlash(`/packing-lists/${input.packingListId}`, "notice", "Packing list reopened for editing. It keeps its number.");
    }
  });
}
