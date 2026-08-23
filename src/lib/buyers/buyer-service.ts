import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import type { BuyerAddressInput, BuyerInput } from "@/lib/validation/buyers";

export async function listBuyers(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  return prisma.buyer.findMany({
    where: { organisationId: tenant.organisationId },
    include: {
      addresses: {
        where: { isActive: true },
        orderBy: [
          { isBillingDefault: "desc" },
          { isShippingDefault: "desc" },
          { createdAt: "asc" }
        ]
      }
    },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }]
  });
}

export async function createBuyer(context: TenantContext, input: BuyerInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.create({
      data: {
        ...input,
        organisationId: tenant.organisationId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "buyer.create",
        entityType: "buyer",
        entityId: buyer.id
      }
    });

    return buyer;
  });
}

export async function createBuyerAddress(context: TenantContext, input: BuyerAddressInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findFirst({
      where: {
        id: input.buyerId,
        organisationId: tenant.organisationId
      }
    });

    if (!buyer) {
      throw new Error("Buyer not found.");
    }

    if (input.isBillingDefault) {
      await tx.buyerAddress.updateMany({
        where: {
          organisationId: tenant.organisationId,
          buyerId: input.buyerId
        },
        data: { isBillingDefault: false }
      });
    }

    if (input.isShippingDefault) {
      await tx.buyerAddress.updateMany({
        where: {
          organisationId: tenant.organisationId,
          buyerId: input.buyerId
        },
        data: { isShippingDefault: false }
      });
    }

    const existingCount = await tx.buyerAddress.count({
      where: {
        organisationId: tenant.organisationId,
        buyerId: input.buyerId
      }
    });

    const address = await tx.buyerAddress.create({
      data: {
        ...input,
        organisationId: tenant.organisationId,
        isBillingDefault: input.isBillingDefault || existingCount === 0,
        isShippingDefault: input.isShippingDefault || existingCount === 0
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "buyer_address.create",
        entityType: "buyer_address",
        entityId: address.id
      }
    });

    return address;
  });
}
