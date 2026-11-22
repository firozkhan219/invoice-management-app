import PDFDocument from "pdfkit";
import { cartonRangeLabel, lineCartonCount } from "@/lib/packing-lists/calculation";

type JsonRecord = Record<string, unknown>;
type Num = string | number | null | undefined;

export type PackingListPdfLine = {
  sortOrder: number;
  packageNo?: string | null;
  cartonFrom?: number | null;
  cartonTo?: number | null;
  piecesPerCarton?: Num;
  netWeightPerPieceKg?: Num;
  grossWeightPerCartonKg?: Num;
  marksAndNumbers?: string | null;
  sku?: string | null;
  description: string;
  hsnSac?: string | null;
  quantity: string | number;
  unitCode?: string | null;
  netWeightKg: string | number;
  grossWeightKg: string | number;
  lengthCm?: Num;
  widthCm?: Num;
  heightCm?: Num;
  volumeCbm: string | number;
};

export type PackingListPdfData = {
  packingListNumber: string;
  packingListDate: Date;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  exportReference?: string | null;
  buyerOrderNumber?: string | null;
  buyerOrderDate?: Date | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  shipmentMode?: string | null;
  preCarriageBy?: string | null;
  placeOfReceipt?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  termsOfDelivery?: string | null;
  countryOfOrigin?: string | null;
  countryOfFinalDestination?: string | null;
  company: JsonRecord | null;
  buyer: JsonRecord | null;
  consignee: JsonRecord | null;
  logo?: { data: Buffer; mimeType: string } | null;
  signature?: { data: Buffer; mimeType: string } | null;
  lines: PackingListPdfLine[];
  totals: {
    packages: string | number;
    quantity: string | number;
    netWeightKg: string | number;
    grossWeightKg: string | number;
    volumeCbm: string | number;
  };
  notes?: string | null;
  /** Draws a "DRAFT" watermark on every page (used for previews of unissued packing lists). */
  draft?: boolean;
};

// A4 portrait, laid out like a customs "Packing & weight list": one ruled frame, export header grid,
// carton-wise lines, weight totals and the declaration / signature boxes.
const A4 = { width: 595.28, height: 841.89 };
const left = 28;
const right = 567;
const width = right - left;
const frameTop = 44;
const frameBottom = 806;
const footerHeight = 118;
const headerRowHeight = 26;
// Columns must add up to the frame width (539pt).
const cols = { ctn: 62, item: 46, description: 271, qty: 52, perPiece: 50, total: 58 };
const colors = { ink: "#111111", muted: "#444444", rule: "#333333", soft: "#f2f2f2" };

export function renderPackingListPdf(data: PackingListPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: left, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawPackingList(doc, data);
    addPageNumbers(doc);
    if (data.draft) addDraftWatermark(doc);
    doc.end();
  });
}

export function packingListPdfFilename(packingListNumber: string): string {
  return `${packingListNumber.replace(/[^a-z0-9-_]+/gi, "-") || "packing-list"}.pdf`;
}

function drawPackingList(doc: PDFKit.PDFDocument, data: PackingListPdfData) {
  doc.lineWidth(0.6).strokeColor(colors.rule).fillColor(colors.ink);

  drawTitle(doc, "Packing & weight list");
  let y = drawHeaderGrid(doc, data, frameTop);
  let tableTop = y;
  drawTableHeader(doc, y);
  y += headerRowHeight + 6;

  const rows = data.lines.map((line) => ({ line, height: rowHeight(doc, line) }));
  for (const row of rows) {
    if (y + row.height > frameBottom - 4) {
      closeTable(doc, tableTop, frameBottom);
      doc.addPage();
      drawTitle(doc, `Packing & weight list - ${data.packingListNumber} (continued)`);
      tableTop = frameTop;
      drawTableHeader(doc, tableTop);
      y = tableTop + headerRowHeight + 6;
    }
    drawRow(doc, row.line, y);
    y += row.height;
  }

  // The totals and declaration sit at the foot of the last page, under the table columns.
  if (y > frameBottom - footerHeight) {
    closeTable(doc, tableTop, frameBottom);
    doc.addPage();
    drawTitle(doc, `Packing & weight list - ${data.packingListNumber} (continued)`);
    tableTop = frameTop;
    drawTableHeader(doc, tableTop);
  }
  closeTable(doc, tableTop, frameBottom - footerHeight);
  drawFooter(doc, data, frameBottom - footerHeight);
}

function drawTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(12).text(title, left, 24, { width, align: "center" });
}

/** Export header: exporter / references, consignee / buyer, then carriage and route boxes. */
function drawHeaderGrid(doc: PDFKit.PDFDocument, data: PackingListPdfData, top: number): number {
  const leftW = 290;
  const rightX = left + leftW;
  const rightW = width - leftW;
  const company = data.company;
  const companyName = text(company, "legalName", "Company");

  // Block 1: exporter | invoice no. & date, exporter's ref, buyer's order, buyer (if other than consignee)
  const block1 = 96;
  box(doc, left, top, leftW, block1);
  label(doc, "EXPORTER", left, top);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(companyName, left + 4, top + 12, { width: leftW - 60 });
  const companyLines = [
    ...addressLines(company),
    text(company, "phone") ? `Tel#: ${text(company, "phone")}` : "",
    text(company, "email")
  ].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(7.8).text(companyLines.join("\n"), left + 4, doc.y + 1, { width: leftW - 60, height: block1 - (doc.y - top) - 4, ellipsis: true });
  drawLogo(doc, left + leftW - 52, top + 8, data.logo);

  const invoiceW = rightW * 0.6;
  box(doc, rightX, top, invoiceW, 30);
  label(doc, "Invoice No. & Date", rightX, top);
  value(doc, invoiceReference(data), rightX, top, invoiceW);
  box(doc, rightX + invoiceW, top, rightW - invoiceW, 30);
  label(doc, "Exporter's Ref.", rightX + invoiceW, top);
  value(doc, data.exportReference || (text(company, "iec") ? `IEC # ${text(company, "iec")}` : ""), rightX + invoiceW, top, rightW - invoiceW);

  box(doc, rightX, top + 30, rightW, 33);
  label(doc, "Buyer's Order No. & Date", rightX, top + 30);
  value(doc, [data.buyerOrderNumber, data.buyerOrderDate ? `DT: ${formatDate(data.buyerOrderDate)}` : ""].filter(Boolean).join(" "), rightX, top + 30, rightW);

  box(doc, rightX, top + 63, rightW, block1 - 63);
  label(doc, "Buyer (if other than consignee)", rightX, top + 63);
  const buyerIsConsignee = !data.consignee || text(data.consignee, "id") === text(data.buyer, "id");
  value(doc, buyerIsConsignee ? "" : partyName(data.buyer), rightX, top + 63, rightW);

  // Block 2: consignee | packing list no., GSTIN | country of origin / final destination
  const top2 = top + block1;
  const block2 = 92;
  const consignee = data.consignee || data.buyer;
  box(doc, left, top2, leftW, block2);
  label(doc, "Consignee", left, top2);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink).text(partyName(consignee), left + 4, top2 + 12, { width: leftW - 8 });
  const consigneeLines = [
    ...addressLines(consignee),
    text(consignee, "phone") ? `TEL: ${text(consignee, "phone")}` : ""
  ].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(7.8).text(consigneeLines.join("\n"), left + 4, doc.y + 1, { width: leftW - 8, height: block2 - (doc.y - top2) - 4, ellipsis: true });

  box(doc, rightX, top2, rightW, block2 - 30);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink).text(
    [
      `PACKING LIST NO. ${data.packingListNumber} DT: ${formatDate(data.packingListDate)}`,
      text(company, "gstin") ? `GST NO - ${text(company, "gstin")}` : "",
      data.containerNumber || data.sealNumber
        ? `CONTAINER: ${data.containerNumber || "-"}   SEAL: ${data.sealNumber || "-"}`
        : ""
    ].filter(Boolean).join("\n"),
    rightX + 6,
    top2 + 10,
    { width: rightW - 12, lineGap: 3 }
  );
  const half = rightW / 2;
  box(doc, rightX, top2 + block2 - 30, half, 30);
  label(doc, "Country of Origin", rightX, top2 + block2 - 30);
  value(doc, (data.countryOfOrigin || "India").toUpperCase(), rightX, top2 + block2 - 30, half);
  box(doc, rightX + half, top2 + block2 - 30, rightW - half, 30);
  label(doc, "Country of final destination", rightX + half, top2 + block2 - 30);
  value(doc, (data.countryOfFinalDestination || data.finalDestination || "").toUpperCase(), rightX + half, top2 + block2 - 30, rightW - half);

  // Block 3: carriage and route (2 x 3 small boxes) | terms of delivery and payment
  const top3 = top2 + block2;
  const cell = 26;
  const smallW = leftW / 2;
  const route: [string, string | null | undefined][] = [
    ["Pre-Carriage by", data.preCarriageBy || data.shipmentMode],
    ["Place of Receipt by Pre-Carrier", data.placeOfReceipt],
    ["Vessel/Flight No.", data.vesselFlightNo],
    ["Port of loading", data.portOfLoading],
    ["Port of discharge", data.portOfDischarge],
    ["Port of final destination", data.finalDestination]
  ];
  route.forEach(([title, content], index) => {
    const x = left + (index % 2) * smallW;
    const y = top3 + Math.floor(index / 2) * cell;
    box(doc, x, y, smallW, cell);
    label(doc, title, x, y);
    value(doc, (content || "").toUpperCase(), x, y, smallW);
  });
  box(doc, rightX, top3, rightW, cell * 3);
  doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text("Terms of delivery and payment", rightX, top3 + 3, { width: rightW, align: "center" });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.ink).text(data.termsOfDelivery || "", rightX + 6, top3 + 15, {
    width: rightW - 12,
    height: cell * 3 - 18,
    ellipsis: true
  });

  return top3 + cell * 3;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  const headers: [string, number, "left" | "center"][] = [
    ["Marks & No.\nCTN NO.", cols.ctn, "left"],
    ["Item No.", cols.item, "center"],
    ["Description of Goods", cols.description, "left"],
    ["Quantity\nin Pcs.", cols.qty, "center"],
    ["NET WT/\nPC (KG)", cols.perPiece, "center"],
    ["TOTAL NET\nWT (KG)", cols.total, "center"]
  ];
  let x = left;
  for (const [title, columnWidth, align] of headers) {
    doc.rect(x, y, columnWidth, headerRowHeight).stroke(colors.rule);
    doc.font("Helvetica").fontSize(7.3).fillColor(colors.ink).text(title, x + 3, y + 5, { width: columnWidth - 6, align });
    x += columnWidth;
  }
}

/** Draws the column rules from the table header down to `bottom`, plus the frame sides. */
function closeTable(doc: PDFKit.PDFDocument, tableTop: number, bottom: number) {
  let x = left;
  const widthsInOrder = [cols.ctn, cols.item, cols.description, cols.qty, cols.perPiece, cols.total];
  doc.lineWidth(0.6).strokeColor(colors.rule);
  doc.moveTo(left, tableTop).lineTo(left, bottom).stroke();
  for (const [index, columnWidth] of widthsInOrder.entries()) {
    x += columnWidth;
    // Like the reference layout, only the number columns are ruled off down the page.
    if (index >= 2) doc.moveTo(x, tableTop + headerRowHeight).lineTo(x, bottom).stroke();
  }
  doc.moveTo(right, tableTop).lineTo(right, bottom).stroke();
  doc.moveTo(left, bottom).lineTo(right, bottom).stroke();
}

function rowHeight(doc: PDFKit.PDFDocument, line: PackingListPdfLine): number {
  doc.font("Helvetica-Bold").fontSize(8.5);
  // Measure exactly what drawRow prints (upper case is wider than mixed case).
  const title = doc.heightOfString(line.description.toUpperCase(), { width: cols.description - 8 });
  const details = detailPairs(line);
  doc.font("Helvetica").fontSize(6.8);
  const marks = line.marksAndNumbers ? doc.heightOfString(line.marksAndNumbers, { width: cols.ctn - 4 }) : 0;
  return Math.max(34, title + 4 + details.length * 9.5 + 14, 26 + marks + 8);
}

function drawRow(doc: PDFKit.PDFDocument, line: PackingListPdfLine, y: number) {
  const cartons = lineCartonCount(line);
  let x = left;

  // CTN NO.: "2 to 8" then "(7 CTNS)", with marks underneath when given.
  const ctnLabel = cartonRangeLabel(line) || String(line.sortOrder).padStart(2, "0");
  doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(ctnLabel, x + 2, y, { width: cols.ctn - 4, align: "center" });
  doc.text(`(${cartons} ${cartons === 1 ? "CTN" : "CTNS"})`, x + 2, doc.y + 1, { width: cols.ctn - 4, align: "center" });
  if (line.marksAndNumbers) {
    doc.fontSize(6.8).fillColor(colors.muted).text(line.marksAndNumbers, x + 2, doc.y + 1, { width: cols.ctn - 4, align: "center" });
  }
  x += cols.ctn;

  doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(line.sku || "", x + 2, y + 2, { width: cols.item - 4, align: "center" });
  x += cols.item;

  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink).text(line.description.toUpperCase(), x + 4, y, { width: cols.description - 8 });
  let detailY = doc.y + 4;
  doc.font("Helvetica").fontSize(6.8).fillColor(colors.ink);
  for (const [leftText, rightText] of detailPairs(line)) {
    doc.text(leftText, x + 4, detailY, { width: 128, lineBreak: false });
    doc.text(rightText, x + 140, detailY, { width: cols.description - 144, lineBreak: false });
    detailY += 9.5;
  }
  x += cols.description;

  const quantity = Number(line.quantity || 0);
  const perPiece = line.netWeightPerPieceKg !== null && line.netWeightPerPieceKg !== undefined && line.netWeightPerPieceKg !== ""
    ? Number(line.netWeightPerPieceKg)
    : quantity > 0 ? Number(line.netWeightKg || 0) / quantity : 0;
  doc.font("Helvetica").fontSize(7.6).fillColor(colors.ink);
  doc.text(formatQty(quantity), x, y + 4, { width: cols.qty, align: "center" });
  x += cols.qty;
  doc.text(formatWeight(perPiece), x, y + 4, { width: cols.perPiece, align: "center" });
  x += cols.perPiece;
  doc.text(formatWeight(line.netWeightKg), x, y + 4, { width: cols.total, align: "center" });
}

/** The small print under each description: pcs/carton, carton size, weight of one and of all cartons. */
function detailPairs(line: PackingListPdfLine): [string, string][] {
  const cartons = lineCartonCount(line);
  const size = [line.lengthCm, line.widthCm, line.heightCm].every((part) => part !== null && part !== undefined && part !== "")
    ? `CTN SIZE: ${formatQty(line.lengthCm)} X ${formatQty(line.widthCm)} X ${formatQty(line.heightCm)}`
    : "";
  const perCarton = line.grossWeightPerCartonKg !== null && line.grossWeightPerCartonKg !== undefined && line.grossWeightPerCartonKg !== ""
    ? Number(line.grossWeightPerCartonKg)
    : cartons > 0 && Number(line.grossWeightKg) > 0 ? Number(line.grossWeightKg) / cartons : 0;
  const pieces = line.piecesPerCarton ? `${formatQty(line.piecesPerCarton)} ${line.unitCode || "PCS"}/CTN` : "";
  const oneCarton = perCarton > 0 ? `1 CTN WEIGHT : ${formatWeight(perCarton)} KG` : "";
  const allCartons = cartons > 1 && Number(line.grossWeightKg) > 0 ? `${cartons} CTN WEIGHT: ${formatWeight(line.grossWeightKg)} KG` : "";
  const hsn = line.hsnSac ? `HSN: ${line.hsnSac}` : "";

  const pairs: [string, string][] = [];
  if (pieces || size) pairs.push([pieces, size]);
  if (oneCarton || allCartons) pairs.push([oneCarton, allCartons]);
  if (hsn) pairs.push([hsn, ""]);
  return pairs;
}

function drawFooter(doc: PDFKit.PDFDocument, data: PackingListPdfData, top: number) {
  const company = data.company;
  // Totals box
  const totalsHeight = 44;
  box(doc, left, top, width, totalsHeight);
  const volume = Number(data.totals.volumeCbm || 0);
  doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink);
  doc.text(`TOTAL NO. OF CARTONS: `, left + 6, top + 6, { continued: true }).font("Helvetica-Bold").text(String(data.totals.packages));
  doc.font("Helvetica").text(`TOTAL NET WEIGHT: `, left + 6, top + 18, { continued: true }).font("Helvetica-Bold").text(`${formatWeight(data.totals.netWeightKg)} KG`);
  doc.font("Helvetica").text(`TOTAL GROSS WEIGHT: `, left + 6, top + 30, { continued: true }).font("Helvetica-Bold").text(`${formatWeight(data.totals.grossWeightKg)} KG`);
  doc.font("Helvetica").text(`TOTAL QUANTITY: `, left + 280, top + 6, { continued: true }).font("Helvetica-Bold").text(`${formatQty(data.totals.quantity)} PCS`);
  if (volume > 0) {
    doc.font("Helvetica").text(`TOTAL VOLUME: `, left + 280, top + 18, { continued: true }).font("Helvetica-Bold").text(`${formatCbm(volume)} CBM`);
  }

  // Declaration | signature
  const signTop = top + totalsHeight;
  const signHeight = footerHeight - totalsHeight;
  const half = 290;
  box(doc, left, signTop, half, signHeight);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(colors.ink).text("Declaration:", left + 4, signTop + 5);
  doc.font("Helvetica").fontSize(7).text(
    data.notes || "We declare that this Invoice shows the actual prices of the goods described and that all particulars are true and correct.",
    left + 4,
    signTop + 18,
    { width: half - 8, height: signHeight - 22, ellipsis: true }
  );

  box(doc, left + half, signTop, width - half, signHeight);
  doc.font("Helvetica-Bold").fontSize(7).text("Signature & Date", left + half + 6, signTop + 5);
  doc.fontSize(9).text(`For, ${text(company, "legalName", "Company")}.`, left + half + 6, signTop + 18, { width: width - half - 12 });
  drawSignatureImage(doc, left + half + 6, signTop + 32, width - half - 12, 22, data.signature);
  doc.fontSize(8.5).text(
    text(company, "signatoryDesignation", "Authorised Signatory"),
    left + half + 6,
    signTop + signHeight - 14,
    { width: width - half - 12, align: "right" }
  );
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.lineWidth(0.6).rect(x, y, w, h).stroke(colors.rule);
}

function label(doc: PDFKit.PDFDocument, title: string, x: number, y: number) {
  doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text(title, x + 4, y + 3, { lineBreak: false });
}

function value(doc: PDFKit.PDFDocument, content: string, x: number, y: number, w: number) {
  if (!content) return;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.ink).text(content, x + 4, y + 13, { width: w - 8, lineBreak: false, ellipsis: true });
}

function invoiceReference(data: PackingListPdfData): string {
  if (!data.invoiceNumber) return "";
  return `${data.invoiceNumber}${data.invoiceDate ? ` DT: ${formatDate(data.invoiceDate)}` : ""}`;
}

function partyName(record: JsonRecord | null): string {
  return (text(record, "legalName") || text(record, "displayName") || "-").toUpperCase();
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, logo: PackingListPdfData["logo"]) {
  if (!logo || !canDrawImage(logo.mimeType)) return;
  try {
    doc.image(logo.data, x, y, { fit: [46, 46], align: "center", valign: "center" });
  } catch {
    // An unreadable logo is skipped; the exporter name is already printed.
  }
}

function drawSignatureImage(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  signature: PackingListPdfData["signature"]
) {
  if (!signature || !canDrawImage(signature.mimeType)) return;
  try {
    doc.image(signature.data, x, y, { fit: [w, h], valign: "center" });
  } catch {
    // Keep the signature box if the uploaded image is not readable.
  }
}

function addDraftWatermark(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.save();
    doc.rotate(-35, { origin: [A4.width / 2, A4.height / 2] });
    doc.font("Helvetica-Bold").fontSize(96).fillColor("#c53030").fillOpacity(0.08);
    doc.text("DRAFT", A4.width / 2 - 260, A4.height / 2 - 48, { width: 520, align: "center", lineBreak: false });
    doc.restore();
  }
  doc.fillOpacity(1);
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Write inside the bottom margin without letting PDFKit start an extra page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor(colors.muted);
    const pageLabel = `Page ${i + 1} of ${range.count}`;
    doc.text(pageLabel, left, 816, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}

function canDrawImage(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

function text(record: JsonRecord | null | undefined, key: string, fallback = ""): string {
  const raw = record?.[key];
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : fallback;
}

function addressLines(record: JsonRecord | null): string[] {
  const place = [text(record, "city"), text(record, "state")].filter(Boolean).join(", ");
  return [
    [text(record, "addressLine1"), text(record, "addressLine2")].filter(Boolean).join(", "),
    [place, text(record, "postcode")].filter(Boolean).join(" - "),
    text(record, "country")
  ].filter(Boolean).map((line) => line.toUpperCase());
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatQty(raw: Num): string {
  return Number(raw || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function formatWeight(raw: Num): string {
  return Number(raw || 0).toFixed(3);
}

function formatCbm(raw: Num): string {
  return Number(raw || 0).toFixed(3);
}
