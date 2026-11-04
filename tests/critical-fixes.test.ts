import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, resolveTaxMode } from "@/lib/invoices/calculation";
import { blankKeys, safeLocalPath, withFlash } from "@/lib/http/form";
import { settlementState } from "@/lib/payments/payment-status";
import { periodRangeForRule, planSequence } from "@/lib/settings/number-series";

const d = (value: number | string) => new Prisma.Decimal(value);

describe("automatic tax mode", () => {
  it("uses CGST+SGST when supplier state equals place of supply", () => {
    expect(resolveTaxMode("automatic", { supplierStateCode: "09", placeOfSupplyStateCode: "9" })).toBe("cgst_sgst");
  });

  it("uses IGST for inter-state or unknown place of supply", () => {
    expect(resolveTaxMode("automatic", { supplierStateCode: "09", placeOfSupplyStateCode: "27" })).toBe("igst");
    expect(resolveTaxMode("automatic", { supplierStateCode: "09", placeOfSupplyStateCode: null })).toBe("igst");
  });

  it("keeps an explicit tax mode", () => {
    expect(resolveTaxMode("zero_rated_export", { supplierStateCode: "09", placeOfSupplyStateCode: "09" })).toBe("zero_rated_export");
  });

  it("splits tax for an intra-state invoice", () => {
    const mode = resolveTaxMode("automatic", { supplierStateCode: "09", placeOfSupplyStateCode: "09" });
    const totals = calculateInvoiceTotals([{ quantity: 1, rate: 1000, gstRate: 18 }], mode);
    expect(totals.cgstTotal.toString()).toBe("90");
    expect(totals.sgstTotal.toString()).toBe("90");
    expect(totals.igstTotal.toString()).toBe("0");
  });
});

describe("number series planning", () => {
  const fyStart = 4;
  const series = { resetRule: "financial_year" as const, startingNumber: 1, nextSequence: 6, lastResetKey: "26-27" };

  it("continues the current period from the counter", () => {
    const plan = planSequence(series, new Date("2026-11-04"), fyStart, 5);
    expect(plan).toEqual({ sequence: 6, resetKey: "26-27", advanceSeries: true });
  });

  it("numbers a back-dated invoice from its own period and leaves the counter alone", () => {
    const plan = planSequence(series, new Date("2026-03-30"), fyStart, 140);
    expect(plan).toEqual({ sequence: 141, resetKey: "25-26", advanceSeries: false });
  });

  it("restarts when a new period begins", () => {
    const plan = planSequence(series, new Date("2027-04-01"), fyStart, null);
    expect(plan).toEqual({ sequence: 1, resetKey: "27-28", advanceSeries: true });
  });

  it("computes financial year ranges", () => {
    const range = periodRangeForRule("financial_year", new Date("2026-02-10"), fyStart);
    expect(range?.start.toISOString().slice(0, 10)).toBe("2025-04-01");
    expect(range?.end.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
});

describe("settlement with credit notes", () => {
  it("reduces the balance by credited amounts", () => {
    const result = settlementState(d(1000), d(300), d(200), "partially_paid");
    expect(result.balanceDue.toString()).toBe("500");
    expect(result.status).toBe("partially_paid");
  });

  it("treats a fully credited invoice as settled", () => {
    const result = settlementState(d(1000), d(0), d(1000), "issued");
    expect(result.balanceDue.toString()).toBe("0");
    expect(result.status).toBe("paid");
  });
});

describe("form helpers", () => {
  it("adds flash messages to paths", () => {
    expect(withFlash("/invoices/1", "error", "Bad thing")).toBe("/invoices/1?error=Bad%20thing");
    expect(withFlash("/payments?invoiceId=1", "notice", "ok")).toBe("/payments?invoiceId=1&notice=ok");
  });

  it("rejects off-site redirect paths", () => {
    expect(safeLocalPath("//evil.example")).toBe("/dashboard");
    expect(safeLocalPath("https://evil.example")).toBe("/dashboard");
    expect(safeLocalPath("/invoices")).toBe("/invoices");
  });

  it("finds submitted blank fields that may be cleared", () => {
    expect(blankKeys({ notes: "", dueDate: " ", currency: "INR", other: "" }, ["notes", "dueDate", "currency"])).toEqual(["notes", "dueDate"]);
  });
});
