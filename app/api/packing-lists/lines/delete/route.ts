import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { deletePackingListLine } from "@/lib/packing-lists/packing-list-service";
import { packingListLineDeleteSchema } from "@/lib/validation/packing-lists";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/packing-lists", fields.packingListId, "/packing-lists"),
    handler: async ({ context, fields }) => {
      const input = parseForm(packingListLineDeleteSchema, fields);
      await deletePackingListLine(context, input);
      return `/packing-lists/${input.packingListId}`;
    }
  });
}
