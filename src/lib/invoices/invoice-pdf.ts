import PDFDocument from "pdfkit";
import { consigneeLines, drawExportHeader, drawExportTitle, exporterReference, headerDate, partyName } from "@/lib/documents/export-header-pdf";

type JsonRecord = Record<string, unknown>;

export type InvoicePdfLine = {
  sortOrder: number;
  description: string;
  hsnSac?: string | null;
  sku?: string | null;
  quantity: string | number;
  unitCode?: string | null;
  rate: string | number;
  taxableAmount: string | number;
  gstRate: string | number;
  igstAmount: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  lineTotal: string | number;
};

export type InvoicePdfData = {
  documentTitle?: string;
  originalInvoiceNumber?: string | null;
  originalInvoiceDate?: Date | null;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  currency: string;
  buyerOrderNumber?: string | null;
  buyerOrderDate?: Date | null;
  exporterReference?: string | null;
  preCarriageBy?: string | null;
  placeOfReceipt?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  termsOfDelivery?: string | null;
  company: JsonRecord | null;
  buyer: JsonRecord | null;
  consignee: JsonRecord | null;
  billingAddress: JsonRecord | null;
  shippingAddress: JsonRecord | null;
  bank: JsonRecord | null;
  logo?: {
    data: Buffer;
    mimeType: string;
  } | null;
  signature?: {
    data: Buffer;
    mimeType: string;
  } | null;
  lines: InvoicePdfLine[];
  totals: {
    subtotal: string | number;
    invoiceDiscount: string | number;
    otherCharges: string | number;
    taxableTotal: string | number;
    igstTotal: string | number;
    cgstTotal: string | number;
    sgstTotal: string | number;
    roundOff: string | number;
    grandTotal: string | number;
  };
  notes?: string | null;
  declaration?: string | null;
  /** Draws a "DRAFT" watermark on every page (previews of unissued invoices). */
  draft?: boolean;
};

// A4 portrait laid out like a customs export invoice: one ruled frame with the export header grid,
// the goods table, the totals / amount-in-words box, bank details, and declaration / signature.
const page = { width: 595.28, height: 841.89 };
const left = 28;
const contentWidth = 539;
const right = left + contentWidth;
const frameTop = 40;
const frameBottom = 806;
const tableHeaderHeight = 28;
const colors = { ink: "#111111", muted: "#444444", rule: "#333333" };
// Must add up to contentWidth (539pt).
const cols = { marks: 50, item: 46, description: 263, qty: 54, rate: 58, amount: 68 };
const colOrder = [cols.marks, cols.item, cols.description, cols.qty, cols.rate, cols.amount];

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: left, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawInvoice(doc, data);
    addFooters(doc, data);
    if (data.draft) addDraftWatermark(doc);
    doc.end();
  });
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^a-z0-9-_]+/gi, "-") || "invoice"}.pdf`;
}

function drawInvoice(doc: PDFKit.PDFDocument, data: InvoicePdfData) {
  const title = data.documentTitle || "Tax Invoice";
  doc.lineWidth(0.6).strokeColor(colors.rule).fillColor(colors.ink);
  drawExportTitle(doc, title, left, contentWidth, 20);
  let y = drawHeader(doc, data, frameTop);
  let tableTop = y;
  drawTableHeader(doc, y, data.currency);
  y += tableHeaderHeight + 6;

  const footerHeight = measureFooter(doc, data);
  for (const [index, line] of data.lines.entries()) {
    const height = rowHeight(doc, line);
    if (y + height > frameBottom - 4) {
      closeTable(doc, tableTop, frameBottom);
      doc.addPage();
      drawExportTitle(doc, `${title} - ${data.invoiceNumber} (continued)`, left, contentWidth, 20);
      tableTop = frameTop;
      drawTableHeader(doc, tableTop, data.currency);
      y = tableTop + tableHeaderHeight + 6;
    }
    drawRow(doc, line, index, y);
    y += height;
  }

  // Totals, bank and signature sit at the foot of the last page, under the table columns.
  if (y > frameBottom - footerHeight) {
    closeTable(doc, tableTop, frameBottom);
    doc.addPage();
    drawExportTitle(doc, `${title} - ${data.invoiceNumber} (continued)`, left, contentWidth, 20);
    tableTop = frameTop;
    drawTableHeader(doc, tableTop, data.currency);
  }
  closeTable(doc, tableTop, frameBottom - footerHeight);
  drawFooter(doc, data, frameBottom - footerHeight);
}

/* ---------- Goods table ---------- */

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, currency: string) {
  const money = currency === "INR" ? "Rs." : currency === "USD" ? "US$" : currency;
  const headers: [string, number, "left" | "center"][] = [
    ["S.No. /\nMarks & No.", cols.marks, "left"],
    ["Item No.", cols.item, "center"],
    ["Description of Goods", cols.description, "left"],
    ["Quantity", cols.qty, "center"],
    [`Rate\n(${money})`, cols.rate, "center"],
    [`Amount\n(${money})`, cols.amount, "center"]
  ];
  let x = left;
  for (const [label, width, align] of headers) {
    doc.lineWidth(0.6).rect(x, y, width, tableHeaderHeight).stroke(colors.rule);
    doc.font("Helvetica").fontSize(7.3).fillColor(colors.ink).text(label, x + 3, y + 5, { width: width - 6, align });
    x += width;
  }
}

/** Column rules from the table header down to `bottom`, plus the frame sides and bottom edge. */
function closeTable(doc: PDFKit.PDFDocument, tableTop: number, bottom: number) {
  doc.lineWidth(0.6).strokeColor(colors.rule);
  doc.moveTo(left, tableTop).lineTo(left, bottom).stroke();
  let x = left;
  colOrder.forEach((width, index) => {
    x += width;
    // As on the reference invoice, only the figure columns are ruled down the page.
    if (index >= 2 && index < colOrder.length - 1) doc.moveTo(x, tableTop + tableHeaderHeight).lineTo(x, bottom).stroke();
  });
  doc.moveTo(right, tableTop).lineTo(right, bottom).stroke();
  doc.moveTo(left, bottom).lineTo(right, bottom).stroke();
}

function rowHeight(doc: PDFKit.PDFDocument, line: InvoicePdfLine): number {
  doc.font("Helvetica-Bold").fontSize(8.5);
  const title = doc.heightOfString(line.description.toUpperCase(), { width: cols.description - 8 });
  return Math.max(28, title + (line.hsnSac ? 12 : 0) + 12);
}

function drawRow(doc: PDFKit.PDFDocument, line: InvoicePdfLine, index: number, y: number) {
  let x = left;
  doc.font("Helvetica").fontSize(8).fillColor(colors.ink).text(String(index + 1), x + 2, y + 1, { width: cols.marks - 4, align: "center" });
  x += cols.marks;
  doc.font("Helvetica").fontSize(8.5).text(line.sku || "", x + 2, y + 1, { width: cols.item - 4, align: "center" });
  x += cols.item;
  doc.font("Helvetica-Bold").fontSize(8.5).text(line.description.toUpperCase(), x + 4, y, { width: cols.description - 8 });
  if (line.hsnSac) {
    doc.font("Helvetica").fontSize(6.8).fillColor(colors.ink).text(`HSN CODE: ${line.hsnSac}`, x + 4, doc.y + 3, { width: cols.description - 8 });
  }
  x += cols.description;

  doc.font("Helvetica").fontSize(7.8).fillColor(colors.ink);
  doc.text(formatQty(line.quantity), x, y + 2, { width: cols.qty, align: "center" });
  if (line.unitCode) doc.fontSize(6.8).text(line.unitCode, x, doc.y + 1, { width: cols.qty, align: "center" });
  x += cols.qty;
  doc.fontSize(7.8).text(money(line.rate), x, y + 2, { width: cols.rate - 4, align: "center" });
  x += cols.rate;
  // Amount = taxable value of the line (qty x rate - line discount); taxes are added in the totals.
  doc.text(money(line.taxableAmount), x, y + 2, { width: cols.amount - 6, align: "right" });
}

/* ---------- Totals, words, bank, declaration and signature ---------- */

const signHeight = 74;

function bankText(data: InvoicePdfData): string {
  const account = text(data.bank, "accountNumber") || (text(data.bank, "accountNumberLast4") ? `xxxxxx${text(data.bank, "accountNumberLast4")}` : "");
  return [
    text(data.bank, "bankName") ? `Bank: ${text(data.bank, "bankName")}` : "",
    text(data.bank, "accountHolderName") ? `A/c name: ${text(data.bank, "accountHolderName")}` : "",
    account ? `A/c no.: ${account}` : "",
    text(data.bank, "ifsc") ? `IFSC: ${text(data.bank, "ifsc")}` : "",
    text(data.bank, "swiftBic") ? `SWIFT: ${text(data.bank, "swiftBic")}` : "",
    text(data.bank, "branchName") ? `Branch: ${text(data.bank, "branchName")}` : ""
  ].filter(Boolean).join("    ");
}

function totalsBoxHeight(doc: PDFKit.PDFDocument, data: InvoicePdfData): number {
  const rows = totalRows(data);
  doc.font("Helvetica-Bold").fontSize(8.5);
  const words = doc.heightOfString(wordsLine(data), { width: contentWidth * 0.58 - 12 });
  return Math.max(rows.length * 12 + 34, words + 30);
}

function bankBoxHeight(doc: PDFKit.PDFDocument, data: InvoicePdfData): number {
  const bank = bankText(data);
  const notes = data.notes || "";
  if (!bank && !notes) return 0;
  doc.font("Helvetica").fontSize(7.5);
  const width = contentWidth - 12;
  return 16 + (bank ? doc.heightOfString(bank, { width }) + 2 : 0) + (notes ? doc.heightOfString(`Notes: ${notes}`, { width }) + 4 : 0);
}

function measureFooter(doc: PDFKit.PDFDocument, data: InvoicePdfData): number {
  return totalsBoxHeight(doc, data) + bankBoxHeight(doc, data) + signHeight;
}

function wordsLine(data: InvoicePdfData): string {
  const code = (data.currency || "INR").toUpperCase();
  const label = code === "INR" ? "TOTAL RUPEES" : code === "USD" ? "TOTAL US DOLLAR" : `TOTAL ${code}`;
  return `${label} : ${amountInWords(Number(data.totals.grandTotal), data.currency)}`;
}

function drawFooter(doc: PDFKit.PDFDocument, data: InvoicePdfData, top: number) {
  // Totals | amount in words
  const totalsHeight = totalsBoxHeight(doc, data);
  const wordsWidth = Math.round(contentWidth * 0.58);
  const totalsX = left + wordsWidth;
  const totalsW = contentWidth - wordsWidth;
  doc.lineWidth(0.6).rect(left, top, wordsWidth, totalsHeight).stroke(colors.rule);
  doc.rect(totalsX, top, totalsW, totalsHeight).stroke(colors.rule);
  doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text("Amount chargeable (in words)", left + 6, top + 5);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink).text(wordsLine(data), left + 6, top + 18, { width: wordsWidth - 12 });

  const rows = totalRows(data);
  let rowY = top + 6;
  rows.slice(0, -1).forEach(([label, value]) => {
    const isDiscount = label.startsWith("Less");
    doc.font("Helvetica").fontSize(8).fillColor(colors.ink).text(label, totalsX + 6, rowY, { width: totalsW * 0.55, lineBreak: false });
    doc.text(`${isDiscount ? "- " : ""}${money(value)}`, totalsX + totalsW * 0.45, rowY, { width: totalsW * 0.55 - 8, align: "right", lineBreak: false });
    rowY += 12;
  });
  const [grandLabel, grandValue] = rows[rows.length - 1];
  const grandY = top + totalsHeight - 22;
  doc.moveTo(totalsX, grandY - 3).lineTo(right, grandY - 3).stroke(colors.rule);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(grandLabel, totalsX + 6, grandY + 3, { width: totalsW * 0.6, lineBreak: false });
  doc.fontSize(10).text(money(grandValue), totalsX + totalsW * 0.4, grandY + 2, { width: totalsW * 0.6 - 8, align: "right", lineBreak: false });

  // Bank details and notes
  let y = top + totalsHeight;
  const bankHeight = bankBoxHeight(doc, data);
  if (bankHeight > 0) {
    doc.rect(left, y, contentWidth, bankHeight).stroke(colors.rule);
    doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text("Bank details", left + 6, y + 4);
    let textY = y + 14;
    const bank = bankText(data);
    if (bank) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(colors.ink).text(bank, left + 6, textY, { width: contentWidth - 12 });
      textY = doc.y + 2;
    }
    if (data.notes) {
      doc.font("Helvetica").fontSize(7.5).fillColor(colors.ink).text(`Notes: ${data.notes}`, left + 6, textY, { width: contentWidth - 12 });
    }
    y += bankHeight;
  }

  // Declaration | signature
  const half = Math.round(contentWidth * 0.538);
  doc.rect(left, y, half, signHeight).stroke(colors.rule);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(colors.ink).text("Declaration:", left + 4, y + 5);
  doc.font("Helvetica").fontSize(7).text(
    data.declaration || "We declare that this Invoice shows the actual prices of the goods described and that all particulars are true and correct.",
    left + 4,
    y + 18,
    { width: half - 8, height: signHeight - 22, ellipsis: true }
  );
  doc.rect(left + half, y, contentWidth - half, signHeight).stroke(colors.rule);
  doc.font("Helvetica-Bold").fontSize(7).text("Signature & Date", left + half + 6, y + 5);
  doc.fontSize(9).text(`For, ${text(data.company, "legalName", "Company")}.`, left + half + 6, y + 18, { width: contentWidth - half - 12 });
  drawSignatureImage(doc, left + half + 6, y + 32, contentWidth - half - 12, 22, data.signature);
  doc.fontSize(8.5).text(
    [text(data.company, "signatoryName"), text(data.company, "signatoryDesignation", "Authorised Signatory")].filter(Boolean).join(", "),
    left + half + 6,
    y + signHeight - 14,
    { width: contentWidth - half - 12, align: "right" }
  );
}

function totalRows(data: InvoicePdfData): Array<[string, string | number]> {
  const code = (data.currency || "INR").toUpperCase();
  const rows: Array<[string, string | number]> = [
    ["Subtotal", data.totals.subtotal],
    // The invoice discount reduces the taxable value, so it is shown before the taxes.
    ["Less: Discount", data.totals.invoiceDiscount],
    ...(Number(data.totals.invoiceDiscount || 0) !== 0 ? [["Taxable value", data.totals.taxableTotal] as [string, string | number]] : []),
    ["IGST", data.totals.igstTotal],
    ["CGST", data.totals.cgstTotal],
    ["SGST", data.totals.sgstTotal],
    ["Other charges", data.totals.otherCharges],
    ["Round off", data.totals.roundOff],
    [code === "INR" ? "Total Amount In Rs." : code === "USD" ? "Total Amount In US $" : `Total Amount In ${code}`, data.totals.grandTotal]
  ];
  return rows.filter(([label, value], index) => index === rows.length - 1 || label === "Subtotal" || Number(value || 0) !== 0);
}

/* ---------- Page furniture ---------- */

function addDraftWatermark(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const cx = page.width / 2;
  const cy = page.height / 2;
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.save();
    doc.rotate(-35, { origin: [cx, cy] });
    doc.font("Helvetica-Bold").fontSize(96).fillColor("#c53030").fillOpacity(0.08);
    doc.text("DRAFT", cx - 260, cy - 48, { width: 520, align: "center", lineBreak: false });
    doc.restore();
  }
  doc.fillOpacity(1);
}

function addFooters(doc: PDFKit.PDFDocument, data: InvoicePdfData) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Write inside the bottom margin without letting PDFKit start an extra page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor(colors.muted);
    doc.text(`${data.documentTitle || "Tax Invoice"} ${data.invoiceNumber}`, left, 814, { width: contentWidth / 2, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, left + contentWidth / 2, 814, { width: contentWidth / 2, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}

function drawSignatureImage(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  signature: InvoicePdfData["signature"]
) {
  if (!signature || !canDrawImage(signature.mimeType)) return;
  try {
    doc.image(signature.data, x, y, { fit: [width, height], valign: "center" });
  } catch {
    // Keep the signature box if the uploaded image cannot be decoded.
  }
}

function canDrawImage(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

function text(record: JsonRecord | null | undefined, key: string, fallback = ""): string {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function money(value: string | number): string {
  return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(value: string | number): string {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

/* ---------- Header: the ruled export grid shared with the packing list ---------- */

function drawHeader(doc: PDFKit.PDFDocument, data: InvoicePdfData, top: number): number {
  const isCredit = data.documentTitle === "Credit Note";
  const isProforma = data.documentTitle === "Proforma Invoice";
  const company = data.company;
  const consignee = data.consignee || data.buyer;
  const shipTo = data.shippingAddress || data.billingAddress;
  const consigneeIsBuyer = !data.consignee || text(data.consignee, "id") === text(data.buyer, "id");
  const destinationCountry = text(data.shippingAddress, "country", text(data.billingAddress, "country", text(data.buyer, "country", "")));

  return drawExportHeader(doc, {
    left,
    width: contentWidth,
    top,
    company,
    logo: data.logo,
    referenceLabel: isCredit ? "Credit Note No. & Date" : isProforma ? "Proforma No. & Date" : "Invoice No. & Date",
    referenceValue: `${data.invoiceNumber} DT: ${headerDate(data.invoiceDate)}`,
    exporterRef: exporterReference(data.exporterReference, company),
    buyerOrder: [data.buyerOrderNumber, data.buyerOrderDate ? `DT: ${headerDate(data.buyerOrderDate)}` : ""].filter(Boolean).join(" "),
    buyerIfOther: consigneeIsBuyer ? "" : partyName(data.buyer),
    consigneeName: partyName(consignee),
    consigneeLines: consigneeLines(consignee, shipTo),
    facts: [
      text(company, "gstin") ? `GST NO - ${text(company, "gstin")}` : "",
      isCredit && data.originalInvoiceNumber
        ? `AGAINST INVOICE ${data.originalInvoiceNumber}${data.originalInvoiceDate ? ` DT: ${headerDate(data.originalInvoiceDate)}` : ""}`
        : "",
      text(data.buyer, "gstin") ? `BUYER GSTIN - ${text(data.buyer, "gstin")}` : "",
      data.dueDate && !isCredit ? `DUE DATE: ${headerDate(data.dueDate)}` : "",
      data.currency && data.currency !== "INR" ? `CURRENCY: ${data.currency}` : ""
    ],
    countryOfOrigin: text(company, "country", "India"),
    countryOfFinalDestination: destinationCountry || data.finalDestination || "",
    preCarriageBy: data.preCarriageBy,
    placeOfReceipt: data.placeOfReceipt,
    vesselFlightNo: data.vesselFlightNo,
    portOfLoading: data.portOfLoading,
    portOfDischarge: data.portOfDischarge,
    finalDestination: data.finalDestination,
    termsOfDelivery: data.termsOfDelivery
  });
}

// Major / minor unit names used when spelling out the grand total.
const currencyWords: Record<string, { major: string; minor: string }> = {
  INR: { major: "Rupees", minor: "Paise" },
  USD: { major: "US Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds Sterling", minor: "Pence" },
  AUD: { major: "Australian Dollars", minor: "Cents" },
  CAD: { major: "Canadian Dollars", minor: "Cents" },
  SGD: { major: "Singapore Dollars", minor: "Cents" },
  AED: { major: "UAE Dirhams", minor: "Fils" },
  SAR: { major: "Saudi Riyals", minor: "Halalas" },
  JPY: { major: "Japanese Yen", minor: "Sen" },
  CNY: { major: "Chinese Yuan", minor: "Fen" },
  CHF: { major: "Swiss Francs", minor: "Centimes" }
};

export function amountInWords(value: number, currency: string): string {
  const code = (currency || "INR").toUpperCase();
  const names = currencyWords[code] ?? { major: code, minor: "" };
  const cents = Math.round(Math.abs(value) * 100);
  const major = Math.floor(cents / 100);
  const minor = cents % 100;
  // Indian numbering (lakh / crore) for INR, international (million / billion) otherwise.
  const toWords = code === "INR" ? numberToIndianWords : numberToInternationalWords;

  const majorWords = `${major === 0 ? "Zero" : toWords(major)} ${names.major}`;
  const minorWords = minor && names.minor ? ` and ${toWords(minor)} ${names.minor}` : "";
  return `${majorWords}${minorWords} Only`;
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const belowHundred = (n: number) => n < 20 ? ones[n] : [tens[Math.floor(n / 10)], ones[n % 10]].filter(Boolean).join(" ");
const belowThousand = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", n % 100 ? belowHundred(n % 100) : ""].filter(Boolean).join(" ");

function numberToInternationalWords(value: number): string {
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];
  const parts: string[] = [];
  for (let i = 0; value > 0 && i < scales.length; i += 1) {
    const chunk = value % 1000;
    if (chunk) parts.unshift([belowThousand(chunk), scales[i]].filter(Boolean).join(" "));
    value = Math.floor(value / 1000);
  }
  return parts.join(" ");
}

function numberToIndianWords(value: number): string {
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000);
  value %= 10000000;
  const lakh = Math.floor(value / 100000);
  value %= 100000;
  const thousand = Math.floor(value / 1000);
  value %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (value) parts.push(belowThousand(value));
  return parts.join(" ");
}
