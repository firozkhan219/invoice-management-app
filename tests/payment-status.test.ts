import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertPaymentWithinBalance, balanceDue, derivePaymentStatus } from "@/lib/payments/payment-status";

describe("payment status derivation", () => {
  it("marks a partially paid invoice", () => {
    expect(derivePaymentStatus(new Prisma.Decimal(1000), new Prisma.Decimal(250), "issued")).toBe("partially_paid");
    expect(balanceDue(new Prisma.Decimal(1000), new Prisma.Decimal(250)).toString()).toBe("750");
  });

  it("marks a fully paid invoice", () => {
    expect(derivePaymentStatus(new Prisma.Decimal(1000), new Prisma.Decimal(1000), "partially_paid")).toBe("paid");
    expect(balanceDue(new Prisma.Decimal(1000), new Prisma.Decimal(1000)).toString()).toBe("0");
  });

  it("restores issued status when all posted payments are reversed", () => {
    expect(derivePaymentStatus(new Prisma.Decimal(1000), new Prisma.Decimal(0), "paid")).toBe("issued");
  });

  it("prevents overpayment without an approved credit policy", () => {
    expect(() =>
      assertPaymentWithinBalance(new Prisma.Decimal(1001), new Prisma.Decimal(1000))
    ).toThrow("exceeds invoice balance");
  });

  it("does not derive payment status for draft or cancelled invoices", () => {
    expect(derivePaymentStatus(new Prisma.Decimal(1000), new Prisma.Decimal(1000), "draft")).toBe("draft");
    expect(derivePaymentStatus(new Prisma.Decimal(1000), new Prisma.Decimal(0), "cancelled")).toBe("cancelled");
  });
});
