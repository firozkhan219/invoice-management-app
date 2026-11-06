import { describe, expect, it } from "vitest";
import { renderCataloguePdf, type CatalogueProduct } from "@/lib/catalogue/catalogue-pdf";

// 1x1 transparent PNG.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

function product(index: number, withPhoto = true): CatalogueProduct {
  return {
    name: `Brass vase ${index}`,
    sku: `BV-${index}`,
    price: "INR 1,000.00",
    category: "Brass",
    subcategory: null,
    description: "Hand-made brass vase with a polished finish and engraved pattern around the neck.",
    hsnSac: "7418",
    unit: "Pieces",
    weightKg: "1.2",
    manufacturer: null,
    barcode: null,
    image: withPhoto ? { data: png, mimeType: "image/png" } : null
  };
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
}

describe("catalogue PDF", () => {
  for (const layout of [1, 2, 4] as const) {
    it(`renders ${layout} product(s) per page`, async () => {
      const products = [product(1), product(2, false), product(3), product(4), product(5)];
      const buffer = await renderCataloguePdf({
        title: "Brass Collection",
        companyName: "Decorative Handicrafts",
        companyContact: "info@example.com",
        logo: null,
        layout,
        fields: ["name", "sku", "price", "description", "weightKg"],
        products
      });
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(pageCount(buffer)).toBe(Math.ceil(products.length / layout));
    });
  }

  it("skips unsupported photo formats without failing", async () => {
    const buffer = await renderCataloguePdf({
      title: "Test",
      companyName: "Test",
      companyContact: null,
      logo: null,
      layout: 4,
      fields: ["name"],
      products: [{ ...product(1), image: { data: Buffer.from("RIFF0000WEBP"), mimeType: "image/webp" } }]
    });
    expect(pageCount(buffer)).toBe(1);
  });
});
