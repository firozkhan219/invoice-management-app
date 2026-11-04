import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import type {
  BuyerAddressInput,
  BuyerAddressUpdateInput,
  BuyerInput,
  BuyerToggleInput,
  BuyerUpdateInput
} from "@/lib/validation/buyers";

export async function listBuyers(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  return prisma.buyer.findMany({
    where: { organisationId: tenant.organisationId },
    include: {
      addresses: {
        orderBy: [
          { isActive: "desc" },
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

function nulls(keys: readonly string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

export async function updateBuyer(context: TenantContext, input: BuyerUpdateInput, clear: readonly string[] = []) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const current = await tx.buyer.findFirst({ where: { id: input.buyerId, organisationId: tenant.organisationId } });
    if (!current) throw new Error("Buyer not found.");
    const { buyerId, ...fields } = input;

    const buyer = await tx.buyer.update({
      where: { id: buyerId },
      data: { ...fields, ...nulls(clear) }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "buyer.update",
        entityType: "buyer",
        entityId: buyer.id
      }
    });

    return buyer;
  });
}

export async function updateBuyerAddress(context: TenantContext, input: BuyerAddressUpdateInput, clear: readonly string[] = []) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const current = await tx.buyerAddress.findFirst({ where: { id: input.addressId, organisationId: tenant.organisationId } });
    if (!current) throw new Error("Buyer address not found.");
    const { addressId, ...fields } = input;

    if (fields.isBillingDefault) {
      await tx.buyerAddress.updateMany({
        where: { organisationId: tenant.organisationId, buyerId: current.buyerId, NOT: { id: addressId } },
        data: { isBillingDefault: false }
      });
    }
    if (fields.isShippingDefault) {
      await tx.buyerAddress.updateMany({
        where: { organisationId: tenant.organisationId, buyerId: current.buyerId, NOT: { id: addressId } },
        data: { isShippingDefault: false }
      });
    }

    const address = await tx.buyerAddress.update({
      where: { id: addressId },
      data: {
        ...fields,
        ...nulls(clear),
        isBillingDefault: fields.isBillingDefault && current.isActive,
        isShippingDefault: fields.isShippingDefault && current.isActive
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "buyer_address.update",
        entityType: "buyer_address",
        entityId: address.id
      }
    });

    return address;
  });
}

/** Soft activate/deactivate. Deactivating an address also clears its default flags. */
export async function setBuyerMasterActive(context: TenantContext, input: BuyerToggleInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const entityType = input.kind === "buyer" ? "buyer" : "buyer_address";

    if (input.kind === "buyer") {
      const found = await tx.buyer.findFirst({ where: { id: input.id, organisationId: tenant.organisationId } });
      if (!found) throw new Error("Buyer not found.");
      await tx.buyer.update({ where: { id: found.id }, data: { isActive: input.active } });
    } else {
      const found = await tx.buyerAddress.findFirst({ where: { id: input.id, organisationId: tenant.organisationId } });
      if (!found) throw new Error("Buyer address not found.");
      await tx.buyerAddress.update({
        where: { id: found.id },
        data: input.active ? { isActive: true } : { isActive: false, isBillingDefault: false, isShippingDefault: false }
      });
    }

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: entityType + (input.active ? ".activate" : ".deactivate"),
        entityType,
        entityId: input.id
      }
    });
  });
}
