import { Prisma } from "@prisma/client";

export type TaxModeInput = "automatic" | "igst" | "cgst_sgst" | "zero_rated_export" | "no_tax";

export type InvoiceCalculationLine = {
  quantity: string | number | Prisma.Decimal;
  rate: string | number | Prisma.Decimal;
  discountAmount?: string | number | Prisma.Decimal;
  gstRate?: string | number | Prisma.Decimal;
};

export type CalculatedLine = {
  taxableAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export type InvoiceTotals = {
  lines: CalculatedLine[];
  subtotal: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);

function decimal(value: string | number | Prisma.Decimal | undefined): Prisma.Decimal {
  if (value === undefined || value === "") return ZERO;
  return new Prisma.Decimal(value);
}

export function calculateLine(line: InvoiceCalculationLine, taxMode: TaxModeInput): CalculatedLine {
  const gross = decimal(line.quantity).mul(decimal(line.rate));
  const taxableAmount = Prisma.Decimal.max(gross.sub(decimal(line.discountAmount)), ZERO);
  const gstRate = taxMode === "zero_rated_export" || taxMode === "no_tax" ? ZERO : decimal(line.gstRate);
  const taxAmount = taxableAmount.mul(gstRate).div(100);
  const isSplit = taxMode === "cgst_sgst";
  const igstAmount = taxMode === "igst" || taxMode === "automatic" ? taxAmount : ZERO;
  const cgstAmount = isSplit ? taxAmount.div(2) : ZERO;
  const sgstAmount = isSplit ? taxAmount.div(2) : ZERO;

  return {
    taxableAmount,
    igstAmount,
    cgstAmount,
    sgstAmount,
    lineTotal: taxableAmount.add(igstAmount).add(cgstAmount).add(sgstAmount)
  };
}

export function calculateInvoiceTotals(
  lines: InvoiceCalculationLine[],
  taxMode: TaxModeInput,
  invoiceDiscount: string | number | Prisma.Decimal = 0,
  otherCharges: string | number | Prisma.Decimal = 0
): InvoiceTotals {
  const calculatedLines = lines.map((line) => calculateLine(line, taxMode));
  const subtotal = calculatedLines.reduce((sum, line) => sum.add(line.taxableAmount), ZERO);
  const taxableTotal = Prisma.Decimal.max(subtotal.sub(decimal(invoiceDiscount)), ZERO);
  const taxBaseRatio = subtotal.equals(0) ? ZERO : taxableTotal.div(subtotal);
  const igstTotal = calculatedLines.reduce((sum, line) => sum.add(line.igstAmount.mul(taxBaseRatio)), ZERO);
  const cgstTotal = calculatedLines.reduce((sum, line) => sum.add(line.cgstAmount.mul(taxBaseRatio)), ZERO);
  const sgstTotal = calculatedLines.reduce((sum, line) => sum.add(line.sgstAmount.mul(taxBaseRatio)), ZERO);
  const beforeRound = taxableTotal.add(igstTotal).add(cgstTotal).add(sgstTotal).add(decimal(otherCharges));
  const rounded = beforeRound.toDecimalPlaces(0);
  const roundOff = rounded.sub(beforeRound);

  return {
    lines: calculatedLines,
    subtotal,
    taxableTotal,
    igstTotal,
    cgstTotal,
    sgstTotal,
    roundOff,
    grandTotal: rounded
  };
}
