import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoicePdfFilename, renderInvoicePdf, type InvoicePdfData } from "@/lib/invoices/invoice-pdf";

describe("invoice PDF rendering", () => {
  it("sanitizes invoice numbers for download filenames", () => {
    expect(invoicePdfFilename("INV/2026/0001")).toBe("INV-2026-0001.pdf");
  });

  it("renders an A4 invoice PDF buffer", async () => {
    const buffer = await renderInvoicePdf(sampleInvoicePdfData());

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});

describe("private document storage", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    vi.resetModules();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("blocks path traversal outside the upload directory", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "invoice-docs-"));
    vi.stubEnv("UPLOAD_DIR", tempDir);
    const { writePrivateDocument } = await import("@/lib/documents/document-storage");

    await expect(writePrivateDocument("../escape.pdf", Buffer.from("bad"))).rejects.toThrow("Invalid document storage path");
  });
});

function sampleInvoicePdfData(): InvoicePdfData {
  return {
    invoiceNumber: "INV/2026/0001",
    invoiceDate: new Date("2026-08-23T00:00:00.000Z"),
    currency: "INR",
    company: {
      legalName: "Example Exports Private Limited",
      addressLine1: "Unit 1, Industrial Area",
      city: "Moradabad",
      state: "Uttar Pradesh",
      postcode: "244001",
      country: "India",
      gstin: "09ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      email: "accounts@example.test"
    },
    buyer: {
      displayName: "Global Buyer LLC",
      gstin: "NA",
      email: "buyer@example.test"
    },
    consignee: null,
    billingAddress: {
      addressLine1: "100 Market Street",
      city: "Mumbai",
      state: "Maharashtra",
      postcode: "400001",
      country: "India"
    },
    shippingAddress: {
      addressLine1: "200 Port Road",
      city: "Nhava Sheva",
      state: "Maharashtra",
      postcode: "400707",
      country: "India"
    },
    bank: {
      bankName: "Example Bank",
      accountHolderName: "Example Exports Private Limited",
      accountNumberLast4: "1234",
      ifsc: "EXAM0001234"
    },
    lines: [{
      sortOrder: 1,
      description: "Decorative handicraft sample item",
      hsnSac: "4420",
      quantity: "10",
      unitCode: "PCS",
      rate: "125.50",
      taxableAmount: "1255.00",
      gstRate: "18",
      igstAmount: "225.90",
      cgstAmount: "0",
      sgstAmount: "0",
      lineTotal: "1480.90"
    }],
    totals: {
      subtotal: "1255.00",
      invoiceDiscount: "0",
      otherCharges: "0",
      taxableTotal: "1255.00",
      igstTotal: "225.90",
      cgstTotal: "0",
      sgstTotal: "0",
      roundOff: "0.10",
      grandTotal: "1481.00"
    },
    notes: "Payment due as agreed.",
    declaration: "Certified that particulars above are true and correct."
  };
}
