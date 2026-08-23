import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals } from "@/lib/invoices/calculation";

describe("invoice calculation engine", () => {
  it("calculates IGST totals", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 2, rate: 100, discountAmount: 0, gstRate: 18 }],
      "igst"
    );

    expect(totals.taxableTotal.toString()).toBe("200");
    expect(totals.igstTotal.toString()).toBe("36");
    expect(totals.grandTotal.toString()).toBe("236");
  });

  it("splits intrastate GST into CGST and SGST", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, rate: 1000, discountAmount: 0, gstRate: 5 }],
      "cgst_sgst"
    );

    expect(totals.igstTotal.toString()).toBe("0");
    expect(totals.cgstTotal.toString()).toBe("25");
    expect(totals.sgstTotal.toString()).toBe("25");
    expect(totals.grandTotal.toString()).toBe("1050");
  });

  it("supports zero-rated export mode", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 3, rate: 99.5, discountAmount: 0, gstRate: 18 }],
      "zero_rated_export"
    );

    expect(totals.igstTotal.toString()).toBe("0");
    expect(totals.grandTotal.toString()).toBe("299");
  });
});
