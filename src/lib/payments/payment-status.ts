import { Prisma, type InvoiceStatus } from "@prisma/client";

const ZERO = new Prisma.Decimal(0);

export function derivePaymentStatus(
  grandTotal: Prisma.Decimal,
  paidTotal: Prisma.Decimal,
  currentStatus: InvoiceStatus
): InvoiceStatus {
  if (currentStatus === "cancelled" || currentStatus === "amended" || currentStatus === "draft") {
    return currentStatus;
  }

  if (paidTotal.lte(ZERO)) return "issued";
  if (paidTotal.gte(grandTotal)) return "paid";
  return "partially_paid";
}

export function balanceDue(grandTotal: Prisma.Decimal, paidTotal: Prisma.Decimal): Prisma.Decimal {
  return Prisma.Decimal.max(grandTotal.sub(paidTotal), ZERO);
}

export function assertPaymentWithinBalance(amount: Prisma.Decimal, balance: Prisma.Decimal): void {
  if (amount.lte(ZERO)) throw new Error("Payment amount must be greater than zero.");
  if (amount.gt(balance)) throw new Error("Payment exceeds invoice balance.");
}
