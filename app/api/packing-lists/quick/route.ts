import { FormError, handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { createQuickPackingList, issuePackingList } from "@/lib/packing-lists/packing-list-service";
import { packingListDraftSchema, quickPackingLineSchema } from "@/lib/validation/packing-lists";

/**
 * One-page packing list: saves the header and every box line in one step and,
 * when asked, issues it so the PDF can be downloaded straight away.
 */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/packing-lists/new",
    handler: async ({ context, fields, formData }) => {
      const column = (name: string) => formData.getAll(name).map(String);
      const descriptions = column("lineDescription");
      const itemIds = column("lineItemId");
      const invoiceItemIds = column("lineInvoiceItemId");
      const boxes = column("lineBox");
      const skus = column("lineSku");
      const hsns = column("lineHsn");
      const units = column("lineUnit");
      const quantities = column("lineQuantity");
      const nets = column("lineNet");
      const grosses = column("lineGross");
      const lengths = column("lineLength");
      const widths = column("lineWidth");
      const heights = column("lineHeight");

      const lines = descriptions
        .map((description, index) => ({ description: description.trim(), index }))
        .filter((line) => line.description)
        .map(({ description, index }, position) => {
          try {
            return parseForm(quickPackingLineSchema, {
              itemId: itemIds[index] ?? "",
              invoiceItemId: invoiceItemIds[index] ?? "",
              packageNo: boxes[index] ?? "",
              sku: skus[index] ?? "",
              description,
              hsnSac: hsns[index] ?? "",
              quantity: quantities[index] || "0",
              unitCode: units[index] ?? "",
              netWeightKg: nets[index] || "0",
              grossWeightKg: grosses[index] || "0",
              lengthCm: lengths[index] ?? "",
              widthCm: widths[index] ?? "",
              heightCm: heights[index] ?? ""
            });
          } catch (error) {
            throw new FormError(`Line ${position + 1}: ${error instanceof Error ? error.message : "check the numbers."}`);
          }
        });
      if (lines.length === 0) throw new FormError("Add at least one product or box line.");

      const draft = parseForm(packingListDraftSchema, {
        invoiceId: fields.invoiceId ?? "",
        companyId: fields.companyId ?? "",
        buyerId: fields.buyerId ?? "",
        packingListDate: fields.packingListDate ?? "",
        exportReference: fields.exportReference ?? "",
        containerNumber: fields.containerNumber ?? "",
        sealNumber: fields.sealNumber ?? "",
        shipmentMode: fields.shipmentMode ?? "",
        portOfLoading: fields.portOfLoading ?? "",
        portOfDischarge: fields.portOfDischarge ?? "",
        finalDestination: fields.finalDestination ?? "",
        notes: fields.notes ?? ""
      });
      if (!draft.invoiceId && !draft.buyerId) throw new FormError("Choose a buyer or an invoice to copy from.");

      const packingList = await createQuickPackingList(context, draft, lines);

      if (fields.intent === "issue") {
        try {
          await issuePackingList(context, { packingListId: packingList.id, expectedVersion: packingList.version });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The packing list could not be finalised.";
          return withFlash(`/packing-lists/${packingList.id}`, "error", `Draft saved but not finalised: ${message}`);
        }
        return withFlash(`/packing-lists/${packingList.id}`, "notice", "Packing list ready. Use Download PDF to get it.");
      }

      return withFlash(`/packing-lists/${packingList.id}`, "notice", "Packing list draft saved.");
    }
  });
}
