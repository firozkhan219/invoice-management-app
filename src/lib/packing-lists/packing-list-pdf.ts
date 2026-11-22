import PDFDocument from "pdfkit";
import { consigneeLines, drawExportHeader, drawExportTitle, exporterReference, headerDate, partyName, text } from "@/lib/documents/export-header-pdf";
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
  drawExportTitle(doc, title, left, width, 24);
}

/** Export header grid shared with the invoice PDFs. */
function drawHeaderGrid(doc: PDFKit.PDFDocument, data: PackingListPdfData, top: number): number {
  const company = data.company;
  const consignee = data.consignee || data.buyer;
  const buyerIsConsignee = !data.consignee || text(data.consignee, "id") === text(data.buyer, "id");
  return drawExportHeader(doc, {
    left,
    width,
    top,
    company,
    logo: data.logo,
    referenceLabel: "Invoice No. & Date",
    referenceValue: data.invoiceNumber ? `${data.invoiceNumber}${data.invoiceDate ? ` DT: ${headerDate(data.invoiceDate)}` : ""}` : "",
    exporterRef: exporterReference(data.exportReference, company),
    buyerOrder: [data.buyerOrderNumber, data.buyerOrderDate ? `DT: ${headerDate(data.buyerOrderDate)}` : ""].filter(Boolean).join(" "),
    buyerIfOther: buyerIsConsignee ? "" : partyName(data.buyer),
    consigneeName: partyName(consignee),
    consigneeLines: consigneeLines(consignee, null),
    facts: [
      `PACKING LIST NO. ${data.packingListNumber} DT: ${headerDate(data.packingListDate)}`,
      text(company, "gstin") ? `GST NO - ${text(company, "gstin")}` : "",
      data.containerNumber || data.sealNumber ? `CONTAINER: ${data.containerNumber || "-"}   SEAL: ${data.sealNumber || "-"}` : ""
    ],
    countryOfOrigin: data.countryOfOrigin || "India",
    countryOfFinalDestination: data.countryOfFinalDestination || data.finalDestination || "",
    preCarriageBy: data.preCarriageBy || data.shipmentMode,
    placeOfReceipt: data.placeOfReceipt,
    vesselFlightNo: data.vesselFlightNo,
    portOfLoading: data.portOfLoading,
    portOfDischarge: data.portOfDischarge,
    finalDestination: data.finalDestination,
    termsOfDelivery: data.termsOfDelivery
  });
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




function formatQty(raw: Num): string {
  return Number(raw || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function formatWeight(raw: Num): string {
  return Number(raw || 0).toFixed(3);
}

function formatCbm(raw: Num): string {
  return Number(raw || 0).toFixed(3);
}
