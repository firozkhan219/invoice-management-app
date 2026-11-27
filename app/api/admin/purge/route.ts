import { verifyStepUp } from "@/lib/auth/two-factor-service";
import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { purgeDocument, type PurgeEntity } from "@/lib/admin/purge-service";
import { hasPermission } from "@/lib/permissions/roles";

const LIST_PATH: Record<PurgeEntity, string> = {
  invoice: "/invoices",
  packing_list: "/packing-lists",
  credit_note: "/credit-notes"
};
const DETAIL_PATH: Record<PurgeEntity, string> = {
  invoice: "/invoices/",
  packing_list: "/packing-lists/",
  credit_note: "/credit-notes/"
};

/** Owner only: permanently deletes one document after re-checking password (and 2FA when on). */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: (fields) => {
      const entity = String(fields.entity ?? "") as PurgeEntity;
      const id = String(fields.id ?? "");
      return entity in DETAIL_PATH && /^[0-9a-f-]{36}$/i.test(id) ? `${DETAIL_PATH[entity]}${id}` : "/dashboard";
    },
    handler: async ({ context, fields }) => {
      const entity = String(fields.entity ?? "") as PurgeEntity;
      const id = String(fields.id ?? "");
      if (!(entity in LIST_PATH) || !/^[0-9a-f-]{36}$/i.test(id)) throw new FormError("Unknown record.");
      if (!hasPermission(context.role, "data:purge")) throw new FormError("Only the owner can delete records permanently.");
      if (fields.confirm !== "yes") throw new FormError("Tick the box to confirm the permanent delete.");

      await verifyStepUp(context.userId, String(fields.password ?? ""), String(fields.code ?? "") || undefined);
      const result = await purgeDocument(context, entity, id);
      return withFlash(LIST_PATH[entity], "notice", `${result.label} was deleted permanently.`);
    }
  });
}
