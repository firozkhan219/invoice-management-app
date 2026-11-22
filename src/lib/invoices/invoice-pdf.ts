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

// A4 is 595.28 x 841.89 pt. Content stays inside the margins; the footer sits below contentBottom.
const page = { width: 595.28, height: 841.89, margin: 36 };
const left = page.margin;
const contentWidth = page.width - page.margin * 2;
const right = left + contentWidth;
const contentBottom = page.height - page.margin - 6;
const footerY = page.height - 26;

// Calm, print-friendly palette: dark ink for reading, one blue accent, soft greys for structure.
const colors = {
  ink: "#1f2a44",
  body: "#334155",
  muted: "#6b7a90",
  line: "#e2e8f0",
  zebra: "#f7f9fc",
  soft: "#f3f6fb",
  accent: "#2855c5",
  accentSoft: "#eaf0fc"
};

const columns = [
  { key: "index", label: "#", width: 22, align: "left" as const },
  { key: "description", label: "Description of goods", width: 0, align: "left" as const },
  { key: "hsn", label: "HSN", width: 46, align: "left" as const },
  { key: "quantity", label: "Qty", width: 44, align: "right" as const },
  { key: "unit", label: "Unit", width: 34, align: "center" as const },
  { key: "rate", label: "Rate", width: 62, align: "right" as const },
  { key: "amount", label: "Amount", width: 78, align: "right" as const }
];
columns[1].width = contentWidth - columns.reduce((sum, column) => sum + column.width, 0);
const cellPad = 6;

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: page.margin, bufferPages: true });
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
  doc.fillColor(colors.ink);
  drawExportTitle(doc, data.documentTitle || "Tax Invoice", left, contentWidth, 18);
  let y = drawHeader(doc, data, 36);
  y = drawItemsTable(doc, data, y + 12);
  y = drawTotals(doc, data, y + 12);
  drawBankAndSignature(doc, data, y + 14);
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

/* ---------- Items table ---------- */

function drawItemsTable(doc: PDFKit.PDFDocument, data: InvoicePdfData, startY: number): number {
  let y = drawTableHeader(doc, startY, data.currency);

  data.lines.forEach((item, index) => {
    const descWidth = columns[1].width - cellPad * 2;
    doc.font("Helvetica").fontSize(8.5);
    const descHeight = doc.heightOfString(item.description, { width: descWidth });
    doc.fontSize(7.5);
    const codeHeight = item.sku ? doc.heightOfString(`Item code ${item.sku}`, { width: descWidth }) + 2 : 0;
    const rowHeight = Math.max(22, descHeight + codeHeight + 11);

    if (y + rowHeight > contentBottom) {
      doc.addPage();
      y = drawTableHeader(doc, page.margin, data.currency);
    }

    if (index % 2 === 1) doc.rect(left, y, contentWidth, rowHeight).fill(colors.zebra);
    doc.save().moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor(colors.line).stroke().restore();

    const values: Record<string, string> = {
      index: String(index + 1),
      hsn: item.hsnSac || "-",
      quantity: formatQty(item.quantity),
      unit: item.unitCode || "",
      rate: money(item.rate),
      // Amount = taxable value of the line (qty x rate - line discount); taxes are added in the totals.
      amount: money(item.taxableAmount)
    };

    let x = left;
    columns.forEach((column) => {
      if (column.key === "description") {
        doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(item.description, x + cellPad, y + 6, { width: descWidth });
        if (item.sku) {
          doc.font("Helvetica").fontSize(7.5).fillColor(colors.muted).text(`Item code ${item.sku}`, x + cellPad, doc.y + 2, { width: descWidth });
        }
      } else {
        const bold = column.key === "amount";
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(column.key === "index" ? colors.muted : colors.ink)
          .text(values[column.key], x + cellPad, y + 6, { width: column.width - cellPad * 2, align: column.align, lineBreak: false });
      }
      x += column.width;
    });
    y += rowHeight;
  });

  return y;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, currency: string): number {
  const height = 24;
  doc.roundedRect(left, y, contentWidth, height, 4).fill(colors.accentSoft);
  let x = left;
  columns.forEach((column) => {
    const label = column.key === "rate" || column.key === "amount" ? `${column.label} (${currency})` : column.label;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(colors.ink).text(label.toUpperCase(), x + cellPad, y + 8.5, {
      width: column.width - cellPad * 2,
      align: column.align,
      characterSpacing: 0.3,
      lineBreak: false
    });
    x += column.width;
  });
  return y + height;
}

/* ---------- Totals and amount in words ---------- */

function drawTotals(doc: PDFKit.PDFDocument, data: InvoicePdfData, y: number): number {
  const rows = visibleTotalRows(data);
  const rowHeight = 18;
  const grandHeight = 28;
  const totalsWidth = 228;
  const totalsX = right - totalsWidth;
  const wordsWidth = totalsX - left - 20;
  const totalsHeight = (rows.length - 1) * rowHeight + grandHeight + 4;

  doc.font("Helvetica").fontSize(9);
  const words = amountInWords(Number(data.totals.grandTotal), data.currency);
  const wordsHeight = 30 + doc.heightOfString(words, { width: wordsWidth - 20 })
    + (data.notes ? 18 + doc.heightOfString(data.notes, { width: wordsWidth - 20 }) : 0);
  const blockHeight = Math.max(totalsHeight, wordsHeight);

  if (y + blockHeight > contentBottom) {
    doc.addPage();
    y = page.margin;
  }

  // Left: amount in words (and notes) in a soft box.
  doc.roundedRect(left, y, wordsWidth, wordsHeight, 6).fill(colors.soft);
  sectionLabel(doc, "Amount in words", left + 10, y + 10, wordsWidth - 20);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink).text(words, left + 10, y + 24, { width: wordsWidth - 20 });
  if (data.notes) {
    const notesY = doc.y + 8;
    sectionLabel(doc, "Notes", left + 10, notesY, wordsWidth - 20);
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.body).text(data.notes, left + 10, notesY + 13, { width: wordsWidth - 20 });
  }

  // Right: label / value rows, then a highlighted grand total.
  let rowY = y;
  rows.forEach(([label, value], index) => {
    const isGrand = index === rows.length - 1;
    if (isGrand) {
      rowY += 4;
      doc.roundedRect(totalsX, rowY, totalsWidth, grandHeight, 5).fill(colors.accent);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#ffffff").text(label, totalsX + 10, rowY + 9.5, { width: 120, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff").text(money(value), totalsX + 120, rowY + 8.5, {
        width: totalsWidth - 130,
        align: "right",
        lineBreak: false
      });
      return;
    }
    const isDiscount = label.startsWith("Less");
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.body).text(label, totalsX + 10, rowY + 5, { width: 120, lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(`${isDiscount ? "- " : ""}${money(value)}`, totalsX + 120, rowY + 5, {
      width: totalsWidth - 130,
      align: "right",
      lineBreak: false
    });
    doc.save().moveTo(totalsX + 10, rowY + rowHeight).lineTo(right - 10, rowY + rowHeight).lineWidth(0.5).strokeColor(colors.line).stroke().restore();
    rowY += rowHeight;
  });

  return y + blockHeight;
}

/* ---------- Bank details, signature and declaration ---------- */

function drawBankAndSignature(doc: PDFKit.PDFDocument, data: InvoicePdfData, y: number) {
  const declaration = data.declaration
    || "We declare that this Invoice shows the actual prices of the goods described and that all particulars are true and correct.";
  const bankLines: Array<[string, string]> = ([
    ["Bank", text(data.bank, "bankName")],
    ["Account name", text(data.bank, "accountHolderName")],
    ["Account no.", text(data.bank, "accountNumber") || (text(data.bank, "accountNumberLast4") ? `xxxxxx${text(data.bank, "accountNumberLast4")}` : "")],
    ["IFSC", text(data.bank, "ifsc")],
    ["SWIFT", text(data.bank, "swiftBic")],
    ["Branch", text(data.bank, "branchName")]
  ] as Array<[string, string]>).filter(([, value]) => value);

  const gap = 20;
  const signWidth = 190;
  const bankWidth = contentWidth - signWidth - gap;
  // Bank details sit in two columns to keep the block short.
  const bankRows = Math.ceil(bankLines.length / 2);
  const boxHeight = Math.max(80, 28 + bankRows * 20);
  doc.font("Helvetica").fontSize(7.5);
  const declarationHeight = 16 + doc.heightOfString(declaration, { width: contentWidth });

  if (y + boxHeight + declarationHeight + 10 > contentBottom) {
    doc.addPage();
    y = page.margin;
  }

  // Bank details
  doc.roundedRect(left, y, bankWidth, boxHeight, 6).lineWidth(0.7).strokeColor(colors.line).stroke();
  sectionLabel(doc, "Bank details", left + 10, y + 10, bankWidth - 20);
  if (bankLines.length === 0) {
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted).text("No bank account selected.", left + 10, y + 26, { width: bankWidth - 20 });
  }
  const bankColWidth = (bankWidth - 20) / 2;
  bankLines.forEach(([label, value], index) => {
    const x = left + 10 + (index % 2) * bankColWidth;
    const rowY = y + 25 + Math.floor(index / 2) * 20;
    doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text(label, x, rowY, { width: bankColWidth - 8, lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(value, x, rowY + 9, { width: bankColWidth - 8, lineBreak: false, ellipsis: true });
  });

  // Signature
  const signX = right - signWidth;
  doc.roundedRect(signX, y, signWidth, boxHeight, 6).lineWidth(0.7).strokeColor(colors.line).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(colors.body).text(`For ${text(data.company, "legalName", "Company")}`, signX + 10, y + 10, {
    width: signWidth - 20,
    align: "center"
  });
  const lineY = y + boxHeight - 30;
  drawSignatureImage(doc, signX + 20, lineY - 30, signWidth - 40, 28, data.signature);
  doc.save().moveTo(signX + 20, lineY).lineTo(signX + signWidth - 20, lineY).lineWidth(0.6).strokeColor(colors.muted).stroke().restore();
  const signatory = [text(data.company, "signatoryName"), text(data.company, "signatoryDesignation", "Authorised Signatory")].filter(Boolean).join("\n");
  doc.font("Helvetica").fontSize(8).fillColor(colors.ink).text(signatory, signX + 10, lineY + 5, { width: signWidth - 20, align: "center" });

  // Declaration
  const declarationY = y + boxHeight + 12;
  sectionLabel(doc, "Declaration", left, declarationY, contentWidth);
  doc.font("Helvetica").fontSize(7.5).fillColor(colors.body).text(declaration, left, declarationY + 13, { width: contentWidth, lineGap: 1 });
}

function visibleTotalRows(data: InvoicePdfData): Array<[string, string | number]> {
  const rows: Array<[string, string | number]> = [
    ["Subtotal", data.totals.subtotal],
    // The invoice discount reduces the taxable value, so it is shown before the taxes.
    ["Less: Discount", data.totals.invoiceDiscount],
    ...(Number(data.totals.invoiceDiscount || 0) !== 0
      ? [["Taxable value", data.totals.taxableTotal] as [string, string | number]]
      : []),
    ["IGST", data.totals.igstTotal],
    ["CGST", data.totals.cgstTotal],
    ["SGST", data.totals.sgstTotal],
    ["Other charges", data.totals.otherCharges],
    ["Round off", data.totals.roundOff],
    [data.currency === "INR" ? "Grand total (Rs.)" : `Grand total (${data.currency})`, data.totals.grandTotal]
  ];
  return rows.filter(([label, value]) => label.startsWith("Grand") || Number(value || 0) !== 0 || label === "Subtotal");
}

function sectionLabel(doc: PDFKit.PDFDocument, label: string, x: number, y: number, width: number) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor(colors.accent).text(label.toUpperCase(), x, y, {
    width,
    characterSpacing: 0.6,
    lineBreak: false
  });
}

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
    // The footer sits inside the bottom margin; drop the margin while writing it so
    // PDFKit does not treat it as overflow and append an empty extra page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save().moveTo(left, footerY - 7).lineTo(right, footerY - 7).lineWidth(0.5).strokeColor(colors.line).stroke().restore();
    doc.font("Helvetica").fontSize(7).fillColor(colors.muted);
    doc.text(`${data.documentTitle || "Tax Invoice"} ${data.invoiceNumber}`, left, footerY, { width: contentWidth / 2, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, left + contentWidth / 2, footerY, { width: contentWidth / 2, align: "right", lineBreak: false });
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
    doc.image(signature.data, x, y, { fit: [width, height], align: "center", valign: "bottom" });
  } catch {
    // Keep the signature line visible if the uploaded image cannot be decoded.
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
