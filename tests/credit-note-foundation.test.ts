import { describe, expect, it } from "vitest";
import { canCreateCreditNoteForInvoice } from "@/lib/credit-notes/credit-note-service";

describe("credit note foundation rules", () => {
  it("allows credit note drafts only for issued or paid invoice states", () => {
    expect(canCreateCreditNoteForInvoice("issued")).toBe(true);
    expect(canCreateCreditNoteForInvoice("partially_paid")).toBe(true);
    expect(canCreateCreditNoteForInvoice("paid")).toBe(true);
  });

  it("blocks credit note drafts for draft and cancelled invoices", () => {
    expect(canCreateCreditNoteForInvoice("draft")).toBe(false);
    expect(canCreateCreditNoteForInvoice("cancelled")).toBe(false);
  });
});
