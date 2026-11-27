import { verifyStepUp } from "@/lib/auth/two-factor-service";
import { prisma } from "@/lib/db/prisma";
import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { resetOrganisationData } from "@/lib/admin/purge-service";
import { hasPermission } from "@/lib/permissions/roles";

/**
 * Owner only: erases all documents (and optionally products and buyers) and restarts numbering.
 * Needs the password, a two-factor code (2FA must be on) and the business name typed exactly.
 */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/settings?tab=danger-zone",
    handler: async ({ context, fields }) => {
      if (!hasPermission(context.role, "data:purge")) throw new FormError("Only the owner can reset the data.");
      const organisation = await prisma.organisation.findUniqueOrThrow({ where: { id: context.organisationId } });
      if (String(fields.confirmName ?? "").trim() !== organisation.name) {
        throw new FormError(`Type the business name exactly as shown (${organisation.name}) to confirm.`);
      }

      await verifyStepUp(context.userId, String(fields.password ?? ""), String(fields.code ?? ""), { requireTwoFactor: true });
      const { counts } = await resetOrganisationData(context, {
        products: fields.products === "yes",
        buyers: fields.buyers === "yes"
      });
      const summary = [
        `${counts.invoices ?? 0} invoices`,
        `${counts.packingLists ?? 0} packing lists`,
        `${counts.creditNotes ?? 0} credit notes`,
        `${counts.payments ?? 0} payments`,
        counts.products !== undefined ? `${counts.products} products` : "",
        counts.buyers !== undefined ? `${counts.buyers} buyers` : ""
      ].filter(Boolean).join(", ");
      return withFlash("/settings?tab=danger-zone", "notice", `Reset complete: erased ${summary}. Numbering starts again at 1. A backup was saved below.`);
    }
  });
}
