import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { assertPaymentWithinBalance, settlementState } from "@/lib/payments/payment-status";
import { assertDateNotLocked } from "@/lib/settings/locked-periods";
import type { PaymentInput, ReversePaymentInput } from "@/lib/validation/payments";

export async function listPayments(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "payments:read");

  return prisma.payment.findMany({
    where: { organisationId: tenant.organisationId },
    include: {
      bankAccount: true,
      allocations: { include: { invoice: { include: { buyer: true } } } }
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }]
  });
}

export async function getPaymentEntryData(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "payments:manage");

  const invoices = await prisma.invoice.findMany({
    where: {
      organisationId: tenant.organisationId,
      status: { in: ["issued", "partially_paid"] },
      balanceDue: { gt: new Prisma.Decimal(0) }
    },
    include: { buyer: true },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }]
  });
  const bankAccounts = await prisma.companyBankAccount.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { bankName: "asc" }]
  });

  return { invoices, bankAccounts };
}

export async function recordPayment(context: TenantContext, input: PaymentInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "payments:manage");

  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await findByIdempotencyKey(tx, tenant.organisationId, input.idempotencyKey);
      if (existing) return existing;
    }

    // Lock the invoice row so concurrent payments are applied one after another.
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId} AND organisation_id = ${tenant.organisationId} FOR UPDATE`;

    if (input.idempotencyKey) {
      const existing = await findByIdempotencyKey(tx, tenant.organisationId, input.idempotencyKey);
      if (existing) return existing;
    }

    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, organisationId: tenant.organisationId }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status !== "issued" && invoice.status !== "partially_paid") {
      throw new Error("Payments can only be recorded against issued invoices with a balance.");
    }
    if (invoice.currency !== input.currency) {
      throw new Error("Payment currency must match the invoice currency.");
    }
    if (input.paymentDate < invoice.invoiceDate) {
      throw new Error("Payment date cannot be before the invoice date.");
    }
    await assertDateNotLocked(tx, tenant.organisationId, input.paymentDate, "record this payment");

    if (input.bankAccountId) {
      const bankExists = await tx.companyBankAccount.count({
        where: { id: input.bankAccountId, organisationId: tenant.organisationId, isActive: true }
      });
      if (!bankExists) throw new Error("Bank account not found.");
    }

    const amount = new Prisma.Decimal(input.amount);
    assertPaymentWithinBalance(amount, invoice.balanceDue);
    const paidTotal = invoice.paidTotal.add(amount);
    const { balanceDue: balance, status } = settlementState(invoice.grandTotal, paidTotal, invoice.creditedTotal, invoice.status);

    const payment = await tx.payment.create({
      data: {
        organisationId: tenant.organisationId,
        paymentDate: input.paymentDate,
        amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        bankAccountId: input.bankAccountId,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        createdById: tenant.userId,
        allocations: {
          create: {
            organisationId: tenant.organisationId,
            invoiceId: invoice.id,
            amount
          }
        }
      },
      include: { allocations: true }
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidTotal,
        balanceDue: balance,
        status,
        updatedById: tenant.userId,
        version: { increment: 1 }
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "payment.record",
        entityType: "payment",
        entityId: payment.id,
        metadata: { invoiceId: invoice.id, amount: amount.toString(), status }
      }
    });

    return payment;
  });
}

function findByIdempotencyKey(tx: Prisma.TransactionClient, organisationId: string, idempotencyKey: string) {
  return tx.payment.findUnique({
    where: { organisationId_idempotencyKey: { organisationId, idempotencyKey } },
    include: { allocations: true }
  });
}

export async function reversePayment(context: TenantContext, input: ReversePaymentInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "payments:manage");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: input.paymentId, organisationId: tenant.organisationId },
      include: { allocations: true }
    });

    if (!payment) throw new Error("Payment not found.");
    if (payment.status === "reversed") throw new Error("Payment is already reversed.");
    await assertDateNotLocked(tx, tenant.organisationId, payment.paymentDate, "reverse this payment");

    // Atomic guard: only one concurrent reversal can flip the status.
    const flipped = await tx.payment.updateMany({
      where: { id: payment.id, status: "posted" },
      data: {
        status: "reversed",
        reversedById: tenant.userId,
        reversedAt: new Date(),
        reversalReason: input.reason
      }
    });
    if (flipped.count === 0) throw new Error("Payment is already reversed.");

    for (const allocation of payment.allocations) {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${allocation.invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: allocation.invoiceId } });
      const paidTotal = Prisma.Decimal.max(invoice.paidTotal.sub(allocation.amount), new Prisma.Decimal(0));
      const { balanceDue: balance, status } = settlementState(invoice.grandTotal, paidTotal, invoice.creditedTotal, invoice.status);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidTotal,
          balanceDue: balance,
          status,
          updatedById: tenant.userId,
          version: { increment: 1 }
        }
      });
    }

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "payment.reverse",
        entityType: "payment",
        entityId: payment.id,
        metadata: { reason: input.reason }
      }
    });

    return payment;
  });
}
