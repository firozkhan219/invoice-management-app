import PDFDocument from "pdfkit";
import type { CatalogueFieldKey, CatalogueLayout } from "@/lib/catalogue/catalogue-fields";

export type CatalogueImage = { data: Buffer; mimeType: string };

export type CatalogueProduct = {
  name: string;
  sku: string | null;
  price: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  hsnSac: string | null;
  unit: string | null;
  weightKg: string | null;
  manufacturer: string | null;
  barcode: string | null;
  image: CatalogueImage | null;
};

export type CataloguePdfData = {
  title: string;
  companyName: string;
  companyContact: string | null;
  logo: CatalogueImage | null;
  layout: CatalogueLayout;
  fields: CatalogueFieldKey[];
  products: CatalogueProduct[];
};

const A4 = { width: 595.28, height: 841.89 };
const margin = 32;
const headerHeight = 58;
const footerHeight = 24;
const gap = 14;
const colors = { ink: "#111827", muted: "#64748b", border: "#e2e8f0", soft: "#f8fafc", accent: "#0f766e" };

const fieldLabels: Record<CatalogueFieldKey, string> = {
  name: "Name",
  sku: "Code",
  price: "Price",
  category: "Category",
  subcategory: "Sub-category",
  description: "Description",
  hsnSac: "HSN",
  unit: "Unit",
  weightKg: "Weight",
  manufacturer: "Maker",
  barcode: "Barcode"
};

export function canDrawCatalogueImage(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

export async function renderCataloguePdf(data: CataloguePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin, bufferPages: true, info: { Title: data.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const perPage = data.layout;
    const pages = Math.max(1, Math.ceil(data.products.length / perPage));

    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage();
      drawHeader(doc, data);
      const slice = data.products.slice(pageIndex * perPage, pageIndex * perPage + perPage);
      slots(perPage).forEach((slot, index) => {
        const product = slice[index];
        if (product) drawCard(doc, slot, product, data.fields, perPage);
      });
    }

    addFooters(doc, data);
    doc.end();
  });
}

type Slot = { x: number; y: number; width: number; height: number };

function slots(perPage: CatalogueLayout): Slot[] {
  const top = margin + headerHeight;
  const contentWidth = A4.width - margin * 2;
  const contentHeight = A4.height - top - margin - footerHeight;

  if (perPage === 1) return [{ x: margin, y: top, width: contentWidth, height: contentHeight }];
  if (perPage === 2) {
    const height = (contentHeight - gap) / 2;
    return [0, 1].map((row) => ({ x: margin, y: top + row * (height + gap), width: contentWidth, height }));
  }
  const width = (contentWidth - gap) / 2;
  const height = (contentHeight - gap) / 2;
  return [0, 1, 2, 3].map((index) => ({
    x: margin + (index % 2) * (width + gap),
    y: top + Math.floor(index / 2) * (height + gap),
    width,
    height
  }));
}

function drawHeader(doc: PDFKit.PDFDocument, data: CataloguePdfData) {
  let textX = margin;
  if (data.logo && canDrawCatalogueImage(data.logo.mimeType)) {
    try {
      doc.image(data.logo.data, margin, margin, { fit: [44, 44], valign: "center" });
      textX = margin + 54;
    } catch {
      // Unreadable logo: header still shows the company name.
    }
  }
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(14).text(data.companyName, textX, margin + 4, {
    width: A4.width - margin - textX, lineBreak: false, ellipsis: true
  });
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(11).text(data.title, textX, margin + 24, {
    width: A4.width - margin - textX, lineBreak: false, ellipsis: true
  });
  doc.moveTo(margin, margin + headerHeight - 10).lineTo(A4.width - margin, margin + headerHeight - 10)
    .lineWidth(0.8).strokeColor(colors.border).stroke();
}

function drawCard(doc: PDFKit.PDFDocument, slot: Slot, product: CatalogueProduct, fields: CatalogueFieldKey[], perPage: CatalogueLayout) {
  doc.roundedRect(slot.x, slot.y, slot.width, slot.height, 6).lineWidth(0.8).strokeColor(colors.border).stroke();

  const lines = detailLines(product, fields);
  const nameSize = perPage === 1 ? 16 : perPage === 2 ? 13 : 11;
  const bodySize = perPage === 1 ? 10.5 : perPage === 2 ? 9.5 : 8.5;
  const pad = perPage === 4 ? 8 : 12;
  const innerWidth = slot.width - pad * 2;

  // Reserve space for details under the photo (2-per-page puts details beside the photo).
  const sideBySide = perPage === 2;
  const detailsWidth = sideBySide ? innerWidth * 0.42 : innerWidth;
  // Never let details take more than ~45% of a card, so the photo stays the hero.
  const detailsHeight = sideBySide
    ? 0
    : Math.min(estimateDetailsHeight(doc, lines, detailsWidth, nameSize, bodySize, perPage), Math.floor(slot.height * 0.45));
  const photo = sideBySide
    ? { x: slot.x + pad, y: slot.y + pad, width: innerWidth - detailsWidth - pad, height: slot.height - pad * 2 }
    : { x: slot.x + pad, y: slot.y + pad, width: innerWidth, height: slot.height - pad * 2 - detailsHeight - (lines.length ? 8 : 0) };

  drawPhoto(doc, photo, product.image);

  const detailsX = sideBySide ? photo.x + photo.width + pad : slot.x + pad;
  const detailsY = sideBySide ? slot.y + pad : photo.y + photo.height + 8;
  const detailsBottom = slot.y + slot.height - pad;
  let y = detailsY;

  for (const line of lines) {
    if (y >= detailsBottom) break;
    const remaining = detailsBottom - y;
    if (line.kind === "name") {
      doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(nameSize);
      doc.text(line.value, detailsX, y, { width: detailsWidth, height: Math.min(remaining, nameSize * 2.6), ellipsis: true });
    } else if (line.kind === "price") {
      doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(bodySize + 1.5);
      doc.text(line.value, detailsX, y, { width: detailsWidth, height: remaining, ellipsis: true, lineBreak: false });
    } else if (line.kind === "description") {
      doc.fillColor(colors.muted).font("Helvetica").fontSize(bodySize);
      const maxLines = perPage === 1 ? 6 : perPage === 2 ? 8 : 2;
      doc.text(line.value, detailsX, y, { width: detailsWidth, height: Math.min(remaining, bodySize * 1.25 * maxLines), ellipsis: true });
    } else {
      doc.font("Helvetica-Bold").fontSize(bodySize).fillColor(colors.muted);
      doc.text(`${line.label}: `, detailsX, y, { continued: true, lineBreak: false });
      doc.font("Helvetica").fillColor(colors.ink).text(line.value, { width: detailsWidth, height: remaining, ellipsis: true, lineBreak: false });
    }
    y = doc.y + (line.kind === "name" ? 3 : 2);
  }
}

type DetailLine = { kind: "name" | "price" | "description" | "field"; label: string; value: string };

function detailLines(product: CatalogueProduct, fields: CatalogueFieldKey[]): DetailLine[] {
  const lines: DetailLine[] = [];
  for (const key of fields) {
    const value = valueFor(product, key);
    if (!value) continue;
    if (key === "name") lines.push({ kind: "name", label: fieldLabels.name, value });
    else if (key === "price") lines.push({ kind: "price", label: fieldLabels.price, value });
    else if (key === "description") lines.push({ kind: "description", label: fieldLabels.description, value });
    else lines.push({ kind: "field", label: fieldLabels[key], value });
  }
  // Name first, then price, then the rest in the order chosen.
  const rank = (line: DetailLine) => (line.kind === "name" ? 0 : line.kind === "price" ? 1 : line.kind === "description" ? 3 : 2);
  return lines.sort((a, b) => rank(a) - rank(b));
}

function valueFor(product: CatalogueProduct, key: CatalogueFieldKey): string | null {
  switch (key) {
    case "name": return product.name;
    case "sku": return product.sku;
    case "price": return product.price;
    case "category": return product.category;
    case "subcategory": return product.subcategory;
    case "description": return product.description?.replace(/\s+/g, " ").trim() || null;
    case "hsnSac": return product.hsnSac;
    case "unit": return product.unit;
    case "weightKg": return product.weightKg ? `${product.weightKg} kg` : null;
    case "manufacturer": return product.manufacturer;
    case "barcode": return product.barcode;
  }
}

function estimateDetailsHeight(
  doc: PDFKit.PDFDocument,
  lines: DetailLine[],
  width: number,
  nameSize: number,
  bodySize: number,
  perPage: CatalogueLayout
): number {
  let height = 0;
  for (const line of lines) {
    if (line.kind === "name") {
      doc.font("Helvetica-Bold").fontSize(nameSize);
      height += Math.min(doc.heightOfString(line.value, { width }), nameSize * 2.6) + 3;
    } else if (line.kind === "description") {
      doc.font("Helvetica").fontSize(bodySize);
      const maxLines = perPage === 1 ? 6 : 2;
      height += Math.min(doc.heightOfString(line.value, { width }), bodySize * 1.25 * maxLines) + 2;
    } else {
      height += (line.kind === "price" ? bodySize + 1.5 : bodySize) * 1.25 + 2;
    }
  }
  // Never let details take more than ~45% of a card (keeps the photo the hero).
  return Math.ceil(height);
}

function drawPhoto(doc: PDFKit.PDFDocument, box: Slot, image: CatalogueImage | null) {
  const height = Math.max(box.height, 40);
  doc.rect(box.x, box.y, box.width, height).fill(colors.soft);
  if (image && canDrawCatalogueImage(image.mimeType)) {
    try {
      doc.image(image.data, box.x + 4, box.y + 4, { fit: [box.width - 8, height - 8], align: "center", valign: "center" });
      return;
    } catch {
      // Fall through to the placeholder for unreadable images.
    }
  }
  const message = image ? "Photo format not supported (use JPG or PNG)" : "No photo";
  doc.fillColor(colors.muted).font("Helvetica").fontSize(9)
    .text(message, box.x, box.y + height / 2 - 5, { width: box.width, align: "center", lineBreak: false });
}

function addFooters(doc: PDFKit.PDFDocument, data: CataloguePdfData) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = A4.height - margin - 10;
    doc.font("Helvetica").fontSize(8).fillColor(colors.muted);
    if (data.companyContact) {
      doc.text(data.companyContact, margin, y, { width: A4.width - margin * 2 - 80, lineBreak: false, ellipsis: true });
    }
    doc.text(`Page ${i + 1} of ${range.count}`, A4.width - margin - 80, y, { width: 80, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}
