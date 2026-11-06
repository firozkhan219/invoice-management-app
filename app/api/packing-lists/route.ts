import { handleTenantForm, idPath, parseForm } from "@/lib/http/form";
import { createPackingListDraft, updatePackingListDraft } from "@/lib/packing-lists/packing-list-service";
import { packingListDraftSchema } from "@/lib/validation/packing-lists";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => idPath("/packing-lists", fields.packingListId, typeof fields.invoiceId === "string" && fields.invoiceId ? idPath("/invoices", fields.invoiceId, "/packing-lists") : "/packing-lists"),
    handler: async ({ context, fields }) => {
      const input = parseForm(packingListDraftSchema, fields);
      const packingListId = typeof fields.packingListId === "string" ? fields.packingListId : "";
      const packingList = packingListId
        ? await updatePackingListDraft(context, packingListId, input)
        : await createPackingListDraft(context, input);
      return `/packing-lists/${packingList.id}`;
    }
  });
}
