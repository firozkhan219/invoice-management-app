import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import type { ItemInput, TaxRateInput, UnitInput } from "@/lib/validation/items";

export async function listItemMasters(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  const units = await prisma.unit.findMany({
    where: { organisationId: tenant.organisationId },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }]
  });
  const taxRates = await prisma.taxRate.findMany({
    where: { organisationId: tenant.organisationId },
    orderBy: [{ isDefault: "desc" }, { rate: "asc" }]
  });
  const items = await prisma.item.findMany({
    where: { organisationId: tenant.organisationId },
    include: { unit: true, taxRate: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  return { units, taxRates, items };
}

export async function createUnit(context: TenantContext, input: UnitInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.unit.updateMany({
        where: { organisationId: tenant.organisationId },
        data: { isDefault: false }
      });
    }

    const existingCount = await tx.unit.count({ where: { organisationId: tenant.organisationId } });
    const unit = await tx.unit.create({
      data: {
        ...input,
        isDefault: input.isDefault || existingCount === 0,
        organisationId: tenant.organisationId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "unit.create",
        entityType: "unit",
        entityId: unit.id
      }
    });

    return unit;
  });
}

export async function createTaxRate(context: TenantContext, input: TaxRateInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.taxRate.updateMany({
        where: { organisationId: tenant.organisationId },
        data: { isDefault: false }
      });
    }

    const existingCount = await tx.taxRate.count({ where: { organisationId: tenant.organisationId } });
    const taxRate = await tx.taxRate.create({
      data: {
        ...input,
        rate: new Prisma.Decimal(input.rate),
        isDefault: input.isDefault || existingCount === 0,
        organisationId: tenant.organisationId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "tax_rate.create",
        entityType: "tax_rate",
        entityId: taxRate.id
      }
    });

    return taxRate;
  });
}

export async function createItem(context: TenantContext, input: ItemInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    if (input.unitId) {
      const unit = await tx.unit.findFirst({
        where: { id: input.unitId, organisationId: tenant.organisationId }
      });

      if (!unit) {
        throw new Error("Unit not found.");
      }
    }

    if (input.taxRateId) {
      const taxRate = await tx.taxRate.findFirst({
        where: { id: input.taxRateId, organisationId: tenant.organisationId }
      });

      if (!taxRate) {
        throw new Error("Tax rate not found.");
      }
    }

    const item = await tx.item.create({
      data: {
        ...input,
        saleRate: input.saleRate === undefined ? undefined : new Prisma.Decimal(input.saleRate),
        organisationId: tenant.organisationId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "item.create",
        entityType: "item",
        entityId: item.id
      }
    });

    return item;
  });
}
