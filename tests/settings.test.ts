import { describe, expect, it } from "vitest";
import { financialYearLabel, isDateInLockedPeriod } from "@/lib/settings/financial-year";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";

describe("financial year helpers", () => {
  it("calculates Indian financial-year labels with April start", () => {
    expect(financialYearLabel(new Date("2026-04-01T00:00:00Z"), 4)).toBe("26-27");
    expect(financialYearLabel(new Date("2027-03-31T00:00:00Z"), 4)).toBe("26-27");
  });

  it("detects active locked periods inclusively", () => {
    expect(
      isDateInLockedPeriod(new Date("2026-08-23T00:00:00Z"), [
        {
          startsOn: new Date("2026-08-01T00:00:00Z"),
          endsOn: new Date("2026-08-31T00:00:00Z"),
          isActive: true
        }
      ])
    ).toBe(true);
  });
});

describe("invoice number series", () => {
  it("renders supported tokens and padded sequence", () => {
    expect(
      renderInvoiceNumber({
        pattern: "{PREFIX}/{FY}/{SEQ:4}",
        prefix: "INV",
        sequence: 7,
        date: new Date("2026-08-23T00:00:00Z"),
        financialYearStartMonth: 4
      })
    ).toBe("INV/26-27/0007");
  });

  it("supports hash placeholders for legacy simple patterns", () => {
    expect(
      renderInvoiceNumber({
        pattern: "INV/{FY}/####",
        prefix: "INV",
        sequence: 7,
        date: new Date("2026-08-23T00:00:00Z"),
        financialYearStartMonth: 4
      })
    ).toBe("INV/26-27/0007");
  });

  it("supports hash placeholders wrapped in braces", () => {
    expect(
      renderInvoiceNumber({
        pattern: "INV/{FY}/{####}",
        prefix: "INV",
        sequence: 7,
        date: new Date("2026-08-23T00:00:00Z"),
        financialYearStartMonth: 4
      })
    ).toBe("INV/26-27/0007");
  });

  it("returns reset keys for calendar and financial years", () => {
    const date = new Date("2026-01-15T00:00:00Z");

    expect(resetKeyForRule("never", date, 4)).toBeNull();
    expect(resetKeyForRule("calendar_year", date, 4)).toBe("2026");
    expect(resetKeyForRule("financial_year", date, 4)).toBe("25-26");
  });
});
