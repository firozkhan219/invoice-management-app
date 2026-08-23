import { describe, expect, it } from "vitest";
import {
  canDeleteDraftInvoiceStatus,
  draftIssueRequirements,
  draftLifecycleLabel
} from "@/lib/invoices/lifecycle";

describe("invoice lifecycle rules", () => {
  it("only allows draft invoices to be deleted", () => {
    expect(canDeleteDraftInvoiceStatus("draft")).toBe(true);
    expect(canDeleteDraftInvoiceStatus("issued")).toBe(false);
    expect(canDeleteDraftInvoiceStatus("paid")).toBe(false);
    expect(canDeleteDraftInvoiceStatus("cancelled")).toBe(false);
  });

  it("reports missing draft issue requirements", () => {
    expect(
      draftIssueRequirements({
        status: "draft",
        companyId: null,
        buyerId: "buyer-1",
        itemCount: 0,
        grandTotal: 0
      })
    ).toEqual([
      "select a company",
      "add at least one line item",
      "make the invoice total greater than zero"
    ]);
  });

  it("marks complete positive drafts as ready to issue", () => {
    const invoice = {
      status: "draft",
      companyId: "company-1",
      buyerId: "buyer-1",
      itemCount: 1,
      grandTotal: 100
    };

    expect(draftIssueRequirements(invoice)).toEqual([]);
    expect(draftLifecycleLabel(invoice)).toBe("Ready to issue");
  });
});
