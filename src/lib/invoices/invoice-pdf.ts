import PDFDocument from "pdfkit";

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
    doc.end();
  });
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^a-z0-9-_]+/gi, "-") || "invoice"}.pdf`;
}

function drawInvoice(doc: PDFKit.PDFDocument, data: InvoicePdfData) {
  doc.fillColor(colors.ink);
  let y = drawHeader(doc, data, page.margin);
  y = drawParties(doc, data, y + 14);
  y = drawShipmentDetails(doc, data, y + 12);
  y = drawItemsTable(doc, data, y + 14);
  y = drawTotals(doc, data, y + 12);
  drawBankAndSignature(doc, data, y + 14);
}

/* ---------- Header: company on the left, document facts on the right ---------- */

function drawHeader(doc: PDFKit.PDFDocument, data: InvoicePdfData, y: number): number {
  const isCredit = data.documentTitle === "Credit Note";
  const companyName = text(data.company, "legalName", "Company");
  const metaWidth = 196;
  const metaX = right - metaWidth;

  // Left: logo (or initials) then company details.
  const markSize = 46;
  drawBrandMark(doc, left, y, markSize, companyName, data.logo);
  const companyX = left + markSize + 12;
  const companyWidth = metaX - companyX - 16;
  let leftY = y;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(colors.ink);
  doc.text(companyName, companyX, leftY, { width: companyWidth });
  leftY = doc.y + 2;
  const tradingName = text(data.company, "tradingName");
  if (tradingName && tradingName !== companyName) {
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted).text(tradingName, companyX, leftY, { width: companyWidth });
    leftY = doc.y + 2;
  }
  const companyLines = [
    ...formatAddressLines(data.company),
    ids(data.company).join("   ")
  ].filter(Boolean);
  doc.font("Helvetica").fontSize(8).fillColor(colors.body).text(companyLines.join("\n"), companyX, leftY, {
    width: companyWidth,
    lineGap: 1.5
  });
  leftY = Math.max(doc.y, y + markSize);

  // Right: title and key facts as label / value rows.
  const title = (data.documentTitle || "Tax Invoice").toUpperCase();
  doc.font("Helvetica-Bold").fontSize(18).fillColor(colors.accent).text(title, metaX, y - 2, {
    width: metaWidth,
    align: "right",
    characterSpacing: 0.6
  });
  let rightY = doc.y + 6;
  const facts: Array<[string, string]> = [
    [isCredit ? "Credit note no." : "Invoice no.", data.invoiceNumber],
    ["Date", formatDate(data.invoiceDate)],
    ["Due date", data.dueDate ? formatDate(data.dueDate) : ""],
    isCredit
      ? ["Original invoice", [data.originalInvoiceNumber, data.originalInvoiceDate ? formatDate(data.originalInvoiceDate) : ""].filter(Boolean).join(" · ")]
      : ["Buyer order", [data.buyerOrderNumber, data.buyerOrderDate ? formatDate(data.buyerOrderDate) : ""].filter(Boolean).join(" · ")],
    ["Exporter ref.", data.exporterReference || ""]
  ];
  facts.filter(([, value]) => value).forEach(([label, value], index) => {
    const bold = index === 0;
    doc.font("Helvetica").fontSize(8).fillColor(colors.muted).text(label, metaX, rightY + 1, { width: 80 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 9.5 : 8.5).fillColor(colors.ink)
      .text(value, metaX + 80, rightY, { width: metaWidth - 80, align: "right" });
    rightY = Math.max(doc.y, rightY + 12) + 3;
  });

  const bottom = Math.max(leftY, rightY) + 12;
  doc.save().moveTo(left, bottom).lineTo(right, bottom).lineWidth(1.4).strokeColor(colors.accent).stroke().restore();
  return bottom;
}

/* ---------- Bill to / Ship to ---------- */

function drawParties(doc: PDFKit.PDFDocument, data: InvoicePdfData, y: number): number {
  const gap = 24;
  const colWidth = (contentWidth - gap) / 2;
  const buyerName = text(data.buyer, "displayName", text(data.buyer, "legalName", "-"));
  const shipName = text(data.consignee, "displayName", buyerName);
  const shipLines = data.shippingAddress ? formatAddressLines(data.shippingAddress) : ["Same as billing address"];

  const billBottom = drawParty(doc, left, y, colWidth, "Bill to", buyerName, [
    ...formatAddressLines(data.billingAddress),
    ids(data.buyer).join("   ")
  ]);
  const shipBottom = drawParty(doc, left + colWidth + gap, y, colWidth, "Ship to / consignee", shipName, [
    ...shipLines,
    ids(data.consignee).join("   ")
  ]);
  return Math.max(billBottom, shipBottom);
}

function drawParty(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, name: string, lines: string[]): number {
  sectionLabel(doc, label, x, y, width);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(colors.ink).text(name, x, y + 14, { width });
  const rest = lines.filter(Boolean);
  if (rest.length) {
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.body).text(rest.join("\n"), x, doc.y + 2, { width, lineGap: 1.5 });
  }
  return doc.y;
}

/* ---------- Shipment details: only the fields that are filled in ---------- */

function drawShipmentDetails(doc: PDFKit.PDFDocument, data: InvoicePdfData, y: number): number {
  const destinationCountry = text(data.shippingAddress, "country", text(data.buyer, "country", ""));
  const fields: Array<[string, string]> = ([
    ["Country of origin", text(data.company, "country", "India")],
    ["Country of final destination", destinationCountry],
    ["Pre-carriage by", data.preCarriageBy || ""],
    ["Place of receipt", data.placeOfReceipt || ""],
    ["Vessel / flight no.", data.vesselFlightNo || ""],
    ["Port of loading", data.portOfLoading || ""],
    ["Port of discharge", data.portOfDischarge || ""],
    ["Final destination", data.finalDestination || ""],
    ["Terms of delivery & payment", data.termsOfDelivery || ""]
  ] as Array<[string, string]>).filter(([, value]) => value);
  if (fields.length === 0) return y;

  const perRow = 3;
  const pad = 9;
  const rowGap = 4;
  const cellWidth = (contentWidth - pad * 2) / perRow;
  const rows: Array<Array<[string, string]>> = [];
  for (let i = 0; i < fields.length; i += perRow) rows.push(fields.slice(i, i + perRow));

  doc.font("Helvetica").fontSize(8.5);
  const rowHeights = rows.map((row) => 11 + Math.max(...row.map(([, value]) => doc.heightOfString(value, { width: cellWidth - 10 }))));
  const boxHeight = pad * 2 + rowHeights.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * rowGap;

  doc.roundedRect(left, y, contentWidth, boxHeight, 6).fill(colors.soft);
  let rowY = y + pad;
  rows.forEach((row, rowIndex) => {
    row.forEach(([label, value], col) => {
      const x = left + pad + col * cellWidth;
      doc.font("Helvetica").fontSize(7).fillColor(colors.muted).text(label.toUpperCase(), x, rowY, { width: cellWidth - 10, characterSpacing: 0.3 });
      doc.font("Helvetica").fontSize(8.5).fillColor(colors.ink).text(value, x, rowY + 10, { width: cellWidth - 10 });
    });
    rowY += rowHeights[rowIndex] + rowGap;
  });
  return y + boxHeight;
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

function drawBrandMark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
  name: string,
  logo: InvoicePdfData["logo"]
) {
  if (logo && canDrawImage(logo.mimeType)) {
    try {
      doc.image(logo.data, x, y, { fit: [size, size], align: "center", valign: "center" });
      return;
    } catch {
      // Fall back to initials if an uploaded image cannot be decoded by PDFKit.
    }
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IM";
  doc.roundedRect(x, y, size, size, 8).fill(colors.accentSoft);
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(15).text(initials, x, y + size / 2 - 7, {
    width: size,
    align: "center",
    lineBreak: false
  });
  doc.fillColor(colors.ink);
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

function ids(record: JsonRecord | null): string[] {
  return [
    text(record, "gstin") ? `GSTIN ${text(record, "gstin")}` : "",
    text(record, "pan") ? `PAN ${text(record, "pan")}` : "",
    text(record, "iec") ? `IEC ${text(record, "iec")}` : ""
  ].filter(Boolean);
}

function formatAddressLines(record: JsonRecord | null): string[] {
  return [
    text(record, "addressLine1"),
    text(record, "addressLine2"),
    [text(record, "city"), text(record, "state"), text(record, "postcode")].filter(Boolean).join(", "),
    text(record, "country"),
    [text(record, "phone") ? `Ph. ${text(record, "phone")}` : "", text(record, "email")].filter(Boolean).join("   ")
  ].filter(Boolean);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function money(value: string | number): string {
  return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(value: string | number): string {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function amountInWords(value: number, currency: string): string {
  if (currency !== "INR") return `${money(value)} ${currency} Only`;
  const rupees = Math.floor(Math.abs(value));
  if (rupees === 0) return "Zero Rupees Only";
  return `${numberToIndianWords(rupees)} Rupees Only`;
}

function numberToIndianWords(value: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const belowHundred = (n: number) => n < 20 ? ones[n] : [tens[Math.floor(n / 10)], ones[n % 10]].filter(Boolean).join(" ");
  const belowThousand = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", n % 100 ? belowHundred(n % 100) : ""].filter(Boolean).join(" ");

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
