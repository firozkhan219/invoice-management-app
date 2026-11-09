import { describe, expect, it } from "vitest";
import { packingListIssueRequirements, shipmentNeedsPorts } from "@/lib/packing-lists/packing-list-service";
import { quickPackingLineSchema } from "@/lib/validation/packing-lists";

const base = {
  companyId: "c",
  buyerId: "b",
  lines: [{}],
  shipmentMode: "By road",
  portOfLoading: null,
  portOfDischarge: null,
  finalDestination: "Delhi"
};

describe("packing list rules", () => {
  it("needs ports only for sea and air", () => {
    expect(shipmentNeedsPorts("By road")).toBe(false);
    expect(shipmentNeedsPorts("By courier")).toBe(false);
    expect(shipmentNeedsPorts("Hand delivery")).toBe(false);
    expect(shipmentNeedsPorts("By sea")).toBe(true);
    expect(shipmentNeedsPorts("By air")).toBe(true);
    expect(shipmentNeedsPorts("")).toBe(true);
  });

  it("lets a road shipment be finalised without ports", () => {
    expect(packingListIssueRequirements(base)).toEqual([]);
  });

  it("still asks for ports on a sea shipment", () => {
    expect(packingListIssueRequirements({ ...base, shipmentMode: "By sea" })).toEqual([
      "enter port of loading",
      "enter port of discharge"
    ]);
  });

  it("parses a quick box line with blank sizes", () => {
    const line = quickPackingLineSchema.parse({
      packageNo: "1", description: "Brass vase", quantity: "10", netWeightKg: "12", grossWeightKg: "13.5",
      lengthCm: "", widthCm: "", heightCm: "", itemId: "", invoiceItemId: ""
    });
    expect(line).toMatchObject({ packageNo: "1", quantity: 10, netWeightKg: 12, grossWeightKg: 13.5, lengthCm: undefined, itemId: undefined });
  });
});
