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
      const cartonFroms = column("lineCtnFrom");
      const cartonTos = column("lineCtnTo");
      const skus = column("lineSku");
      const marks = column("lineMarks");
      const hsns = column("lineHsn");
      const units = column("lineUnit");
      const piecesPerCarton = column("linePcsPerCtn");
      const netPerPiece = column("lineNetPerPc");
      const grossPerCarton = column("lineGrossPerCtn");
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
              cartonFrom: cartonFroms[index] ?? "",
              cartonTo: cartonTos[index] ?? "",
              sku: skus[index] ?? "",
              marksAndNumbers: marks[index] ?? "",
              description,
              hsnSac: hsns[index] ?? "",
              unitCode: units[index] ?? "",
              piecesPerCarton: piecesPerCarton[index] ?? "",
              netWeightPerPieceKg: netPerPiece[index] ?? "",
              grossWeightPerCartonKg: grossPerCarton[index] ?? "",
              lengthCm: lengths[index] ?? "",
              widthCm: widths[index] ?? "",
              heightCm: heights[index] ?? ""
            });
          } catch (error) {
            throw new FormError(`Row ${position + 1}: ${error instanceof Error ? error.message : "check the numbers."}`);
          }
        });
      if (lines.length === 0) throw new FormError("Add at least one carton row.");

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
        buyerOrderNumber: fields.buyerOrderNumber ?? "",
        buyerOrderDate: fields.buyerOrderDate ?? "",
        preCarriageBy: fields.preCarriageBy ?? "",
        placeOfReceipt: fields.placeOfReceipt ?? "",
        vesselFlightNo: fields.vesselFlightNo ?? "",
        termsOfDelivery: fields.termsOfDelivery ?? "",
        countryOfOrigin: fields.countryOfOrigin ?? "",
        countryOfFinalDestination: fields.countryOfFinalDestination ?? "",
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
