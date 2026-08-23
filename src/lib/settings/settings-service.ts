import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";
import type {
  LockedPeriodInput,
  NumberSeriesActionInput,
  NumberSeriesInput,
  OrganisationSettingsInput
} from "@/lib/validation/settings";

export async function getSettingsWorkspace(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "organisation:read");

  const organisation = await prisma.organisation.findUniqueOrThrow({ where: { id: tenant.organisationId } });
  const settings = await prisma.organisationSettings.findUnique({ where: { organisationId: tenant.organisationId } });
  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
  });
  const bankAccounts = await prisma.companyBankAccount.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { bankName: "asc" }]
  });
  const lockedPeriods = await prisma.lockedPeriod.findMany({
    where: { organisationId: tenant.organisationId },
    orderBy: [{ isActive: "desc" }, { startsOn: "desc" }]
  });
  const series = await prisma.invoiceNumberSeries.findMany({
    where: { organisationId: tenant.organisationId },
    include: { company: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });
  const creditNoteSeries = await prisma.creditNoteNumberSeries.findMany({
    where: { organisationId: tenant.organisationId },
    include: { company: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  });

  return { organisation, settings, companies, bankAccounts, lockedPeriods, series, creditNoteSeries };
}

export async function upsertOrganisationSettings(
  context: TenantContext,
  input: OrganisationSettingsInput
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "organisation:update");

  return prisma.$transaction(async (tx) => {
    if (input.defaultCompanyId) {
      const company = await tx.company.findFirst({
        where: { id: input.defaultCompanyId, organisationId: tenant.organisationId }
      });
      if (!company) throw new Error("Default company not found.");
    }

    if (input.defaultBankAccountId) {
      const bankAccount = await tx.companyBankAccount.findFirst({
        where: { id: input.defaultBankAccountId, organisationId: tenant.organisationId }
      });
      if (!bankAccount) throw new Error("Default bank account not found.");
    }

    const settings = await tx.organisationSettings.upsert({
      where: { organisationId: tenant.organisationId },
      create: { ...input, organisationId: tenant.organisationId },
      update: input
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "organisation_settings.update",
        entityType: "organisation_settings",
        entityId: settings.id
      }
    });

    return settings;
  });
}

export async function createLockedPeriod(context: TenantContext, input: LockedPeriodInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "organisation:update");

  return prisma.$transaction(async (tx) => {
    const lockedPeriod = await tx.lockedPeriod.create({
      data: {
        ...input,
        organisationId: tenant.organisationId,
        createdById: tenant.userId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "locked_period.create",
        entityType: "locked_period",
        entityId: lockedPeriod.id
      }
    });

    return lockedPeriod;
  });
}

export async function createNumberSeries(context: TenantContext, input: NumberSeriesInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "organisation:update");

  return prisma.$transaction(async (tx) => {
    if (input.companyId) {
      const company = await tx.company.findFirst({
        where: { id: input.companyId, organisationId: tenant.organisationId }
      });
      if (!company) throw new Error("Company not found.");
    }

    const duplicateActivePattern = await tx.invoiceNumberSeries.findFirst({
      where: {
        organisationId: tenant.organisationId,
        companyId: input.companyId ?? null,
        pattern: input.pattern,
        isActive: true
      },
      select: { id: true }
    });
    if (duplicateActivePattern) {
      throw new Error("An active number series with this pattern already exists for this scope.");
    }

    if (input.isDefault) {
      await tx.invoiceNumberSeries.updateMany({
        where: { organisationId: tenant.organisationId, companyId: input.companyId ?? null },
        data: { isDefault: false }
      });
    }

    const existingCount = await tx.invoiceNumberSeries.count({
      where: { organisationId: tenant.organisationId, companyId: input.companyId ?? null }
    });

    const series = await tx.invoiceNumberSeries.create({
      data: {
        ...input,
        nextSequence: input.startingNumber,
        isDefault: input.isDefault || existingCount === 0,
        organisationId: tenant.organisationId
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_number_series.create",
        entityType: "invoice_number_series",
        entityId: series.id
      }
    });

    return series;
  });
}

export async function updateNumberSeriesAction(
  context: TenantContext,
  input: NumberSeriesActionInput
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "organisation:update");

  return prisma.$transaction(async (tx) => {
    const series = await tx.invoiceNumberSeries.findFirst({
      where: { id: input.seriesId, organisationId: tenant.organisationId }
    });
    if (!series) throw new Error("Invoice number series not found.");

    if (input.action === "make_default") {
      if (!series.isActive) throw new Error("Inactive series cannot be made default.");
      await tx.invoiceNumberSeries.updateMany({
        where: { organisationId: tenant.organisationId, companyId: series.companyId },
        data: { isDefault: false }
      });
      const updated = await tx.invoiceNumberSeries.update({
        where: { id: series.id },
        data: { isDefault: true }
      });
      await tx.auditLog.create({
        data: {
          organisationId: tenant.organisationId,
          actorUserId: tenant.userId,
          action: "invoice_number_series.default",
          entityType: "invoice_number_series",
          entityId: updated.id
        }
      });
      return updated;
    }

    const activeSeriesInScope = await tx.invoiceNumberSeries.count({
      where: {
        organisationId: tenant.organisationId,
        companyId: series.companyId,
        isActive: true,
        NOT: { id: series.id }
      }
    });
    if (series.isDefault && activeSeriesInScope === 0) {
      throw new Error("Create or select another active default series before deactivating this one.");
    }

    const updated = await tx.invoiceNumberSeries.update({
      where: { id: series.id },
      data: { isActive: false, isDefault: false }
    });
    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "invoice_number_series.deactivate",
        entityType: "invoice_number_series",
        entityId: updated.id
      }
    });

    return updated;
  });
}

export async function allocateInvoiceNumber(
  context: TenantContext,
  seriesId: string,
  invoiceDate: Date
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "invoices:issue");

  return prisma.$transaction(
    async (tx) => {
      const organisation = await tx.organisation.findUniqueOrThrow({
        where: { id: tenant.organisationId }
      });
      const series = await tx.invoiceNumberSeries.findFirst({
        where: { id: seriesId, organisationId: tenant.organisationId, isActive: true }
      });

      if (!series) throw new Error("Invoice number series not found.");

      const resetKey = resetKeyForRule(
        series.resetRule,
        invoiceDate,
        organisation.financialYearStart
      );
      const shouldReset = resetKey !== null && series.lastResetKey !== resetKey;
      const sequence = shouldReset ? series.startingNumber : series.nextSequence;
      const invoiceNumber = renderInvoiceNumber({
        pattern: series.pattern,
        prefix: series.prefix,
        sequence,
        date: invoiceDate,
        financialYearStartMonth: organisation.financialYearStart
      });

      await tx.invoiceNumberSeries.update({
        where: { id: series.id },
        data: {
          nextSequence: sequence + 1,
          lastResetKey: resetKey
        }
      });

      return { invoiceNumber, sequenceNumber: sequence, seriesId: series.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
