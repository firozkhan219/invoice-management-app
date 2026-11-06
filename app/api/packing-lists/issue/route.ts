import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { issuePackingList } from "@/lib/packing-lists/packing-list-service";
import { packingListIssueSchema } from "@/lib/validation/packing-lists";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/packing-lists", fields.packingListId, "/packing-lists"),
    handler: async ({ context, fields }) => {
      const input = parseForm(packingListIssueSchema, fields);
      await issuePackingList(context, input);
      return `/packing-lists/${input.packingListId}`;
    }
  });
}
