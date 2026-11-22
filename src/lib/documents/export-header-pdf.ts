/**
 * The ruled export-document header shared by the invoice, proforma, credit note and packing list PDFs:
 *
 *   EXPORTER                         | Invoice No. & Date | Exporter's Ref.
 *                                    | Buyer's Order No. & Date
 *                                    | Buyer (if other than consignee)
 *   Consignee                        | GST NO / document facts
 *                                    | Country of origin | Country of final destination
 *   Pre-carriage | Place of receipt  | Terms of delivery and payment
 *   Vessel/flight | Port of loading  |
 *   Port of discharge | Final dest.  |
 */

export type JsonRecord = Record<string, unknown>;

export type ExportHeaderInput = {
  left: number;
  width: number;
  top: number;
  company: JsonRecord | null;
  logo?: { data: Buffer; mimeType: string } | null;
  referenceLabel: string;
  referenceValue: string;
  exporterRef: string;
  buyerOrder: string;
  /** Printed only when the buyer is a different party from the consignee. */
  buyerIfOther: string;
  consigneeName: string;
  consigneeLines: string[];
  /** Bold lines in the box to the right of the consignee (GST no., document facts). */
  facts: string[];
  countryOfOrigin: string;
  countryOfFinalDestination: string;
  preCarriageBy?: string | null;
  placeOfReceipt?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  termsOfDelivery?: string | null;
};

const ink = "#111111";
const muted = "#444444";
const rule = "#333333";

/** Draws the header grid and returns the y coordinate just below it. */
export function drawExportHeader(doc: PDFKit.PDFDocument, input: ExportHeaderInput): number {
  const { left, width, top, company } = input;
  const leftW = Math.round(width * 0.538);
  const rightX = left + leftW;
  const rightW = width - leftW;
  const companyName = text(company, "legalName", "Company");

  // Block 1: exporter | reference & exporter's ref, buyer's order, buyer (if other than consignee)
  const block1 = 96;
  box(doc, left, top, leftW, block1);
  label(doc, "EXPORTER", left, top);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(companyName, left + 4, top + 12, { width: leftW - 60 });
  const companyLines = [
    ...addressLines(company),
    text(company, "phone") ? `Tel#: ${text(company, "phone")}` : "",
    text(company, "email")
  ].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(7.8).text(companyLines.join("\n"), left + 4, doc.y + 1, {
    width: leftW - 60,
    height: Math.max(10, block1 - (doc.y - top) - 4),
    ellipsis: true
  });
  drawLogo(doc, left + leftW - 52, top + 8, input.logo);

  const refW = rightW * 0.6;
  box(doc, rightX, top, refW, 30);
  label(doc, input.referenceLabel, rightX, top);
  value(doc, input.referenceValue, rightX, top, refW);
  box(doc, rightX + refW, top, rightW - refW, 30);
  label(doc, "Exporter's Ref.", rightX + refW, top);
  value(doc, input.exporterRef, rightX + refW, top, rightW - refW);

  box(doc, rightX, top + 30, rightW, 33);
  label(doc, "Buyer's Order No. & Date", rightX, top + 30);
  value(doc, input.buyerOrder, rightX, top + 30, rightW);

  box(doc, rightX, top + 63, rightW, block1 - 63);
  label(doc, "Buyer (if other than consignee)", rightX, top + 63);
  value(doc, input.buyerIfOther, rightX, top + 63, rightW);

  // Block 2: consignee | facts | countries
  const top2 = top + block1;
  const block2 = 96;
  box(doc, left, top2, leftW, block2);
  label(doc, "Consignee", left, top2);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(input.consigneeName, left + 4, top2 + 12, { width: leftW - 8 });
  doc.font("Helvetica-Bold").fontSize(7.8).text(input.consigneeLines.filter(Boolean).join("\n"), left + 4, doc.y + 1, {
    width: leftW - 8,
    height: Math.max(10, block2 - (doc.y - top2) - 4),
    ellipsis: true
  });

  box(doc, rightX, top2, rightW, block2 - 30);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(input.facts.filter(Boolean).join("\n"), rightX + 6, top2 + 10, {
    width: rightW - 12,
    height: block2 - 42,
    lineGap: 3,
    ellipsis: true
  });
  const half = rightW / 2;
  box(doc, rightX, top2 + block2 - 30, half, 30);
  label(doc, "Country of origin of goods", rightX, top2 + block2 - 30);
  value(doc, input.countryOfOrigin.toUpperCase(), rightX, top2 + block2 - 30, half);
  box(doc, rightX + half, top2 + block2 - 30, rightW - half, 30);
  label(doc, "Country of final destination", rightX + half, top2 + block2 - 30);
  value(doc, input.countryOfFinalDestination.toUpperCase(), rightX + half, top2 + block2 - 30, rightW - half);

  // Block 3: carriage and route boxes | terms of delivery and payment
  const top3 = top2 + block2;
  const cell = 26;
  const smallW = leftW / 2;
  const route: [string, string | null | undefined][] = [
    ["Pre-Carriage by", input.preCarriageBy],
    ["Place of Receipt by Pre-Carrier", input.placeOfReceipt],
    ["Vessel/Flight No.", input.vesselFlightNo],
    ["Port of loading", input.portOfLoading],
    ["Port of discharge", input.portOfDischarge],
    ["Port of final destination", input.finalDestination]
  ];
  route.forEach(([title, content], index) => {
    const x = left + (index % 2) * smallW;
    const y = top3 + Math.floor(index / 2) * cell;
    box(doc, x, y, smallW, cell);
    label(doc, title, x, y);
    value(doc, (content || "").toUpperCase(), x, y, smallW);
  });
  box(doc, rightX, top3, rightW, cell * 3);
  label(doc, "Terms of Delivery and Payment", rightX, top3);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(ink).text(input.termsOfDelivery || "", rightX + 6, top3 + 14, {
    width: rightW - 12,
    height: cell * 3 - 17,
    ellipsis: true
  });

  doc.fillColor(ink);
  return top3 + cell * 3;
}

/** Centered document title above the grid ("Invoice", "Proforma Invoice", "Packing & weight list"). */
export function drawExportTitle(doc: PDFKit.PDFDocument, title: string, left: number, width: number, y: number) {
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(title, left, y, { width, align: "center" });
}

/** Consignee address block: street, city - postcode, country, Tel, ATTN. */
export function consigneeLines(party: JsonRecord | null, address: JsonRecord | null): string[] {
  const source = address || party;
  const phone = text(address, "phone") || text(party, "phone");
  const attention = text(address, "contactPerson") || text(party, "contactPerson");
  return [
    ...addressLines(source),
    phone ? `Tel: ${phone}` : "",
    attention ? `ATTN: ${attention.toUpperCase()}` : ""
  ].filter(Boolean);
}

export function partyName(record: JsonRecord | null): string {
  return (text(record, "legalName") || text(record, "displayName") || "-").toUpperCase();
}

export function addressLines(record: JsonRecord | null): string[] {
  const place = [text(record, "city"), text(record, "state")].filter(Boolean).join(", ");
  return [
    [text(record, "addressLine1"), text(record, "addressLine2")].filter(Boolean).join(", "),
    [place, text(record, "postcode")].filter(Boolean).join(" - "),
    text(record, "country")
  ].filter(Boolean).map((line) => line.toUpperCase());
}

export function exporterReference(explicit: string | null | undefined, company: JsonRecord | null): string {
  if (explicit) return explicit;
  return text(company, "iec") ? `IEC # ${text(company, "iec")}` : "";
}

export function headerDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function text(record: JsonRecord | null | undefined, key: string, fallback = ""): string {
  const raw = record?.[key];
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : fallback;
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.lineWidth(0.6).rect(x, y, w, h).stroke(rule);
}

function label(doc: PDFKit.PDFDocument, title: string, x: number, y: number) {
  doc.font("Helvetica").fontSize(7).fillColor(muted).text(title, x + 4, y + 3, { lineBreak: false });
}

function value(doc: PDFKit.PDFDocument, content: string, x: number, y: number, w: number) {
  if (!content) return;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(ink).text(content, x + 4, y + 13, { width: w - 8, lineBreak: false, ellipsis: true });
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, logo: ExportHeaderInput["logo"]) {
  if (!logo || !(logo.mimeType === "image/png" || logo.mimeType === "image/jpeg" || logo.mimeType === "image/jpg")) return;
  try {
    doc.image(logo.data, x, y, { fit: [46, 46], align: "center", valign: "center" });
  } catch {
    // An unreadable logo is skipped; the exporter name is already printed.
  }
}
