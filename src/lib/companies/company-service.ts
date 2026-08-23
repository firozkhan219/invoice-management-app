import { prisma } from "@/lib/db/prisma";
import { accountLast4, maskAccountNumber, normaliseAccountNumber } from "@/lib/companies/bank-account";
import { encryptSensitiveText } from "@/lib/security/encryption";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import type { BankAccountInput, CompanyInput } from "@/lib/validation/companies";

export async function listCompanies(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId },
    include: {
      bankAccounts: {
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
  });

  return companies.map((company) => ({
    ...company,
    bankAccounts: company.bankAccounts.map((account) => ({
      ...account,
      maskedAccountNumber: maskAccountNumber(account.accountNumberLast4)
    }))
  }));
}

export async function createCompany(context: TenantContext, input: CompanyInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.company.updateMany({
        where: { organisationId: tenant.organisationId },
        data: { isDefault: false }
      });
    }

    const existingCount = await tx.company.count({
      where: { organisationId: tenant.organisationId }
    });

    const company = await tx.company.create({
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
        action: "company.create",
        entityType: "company",
        entityId: company.id
      }
    });

    return company;
  });
}

export async function createBankAccount(context: TenantContext, input: BankAccountInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");
  const accountNumber = normaliseAccountNumber(input.accountNumber);
  const encrypted = encryptSensitiveText(accountNumber);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({
      where: {
        id: input.companyId,
        organisationId: tenant.organisationId
      }
    });

    if (!company) {
      throw new Error("Company not found.");
    }

    if (input.isDefault) {
      await tx.companyBankAccount.updateMany({
        where: {
          organisationId: tenant.organisationId,
          companyId: input.companyId
        },
        data: { isDefault: false }
      });
    }

    const existingCount = await tx.companyBankAccount.count({
      where: {
        organisationId: tenant.organisationId,
        companyId: input.companyId
      }
    });

    const account = await tx.companyBankAccount.create({
      data: {
        organisationId: tenant.organisationId,
        companyId: input.companyId,
        bankName: input.bankName,
        accountHolderName: input.accountHolderName,
        accountNumberCiphertext: encrypted.ciphertext,
        accountNumberIv: encrypted.iv,
        accountNumberTag: encrypted.tag,
        accountNumberLast4: accountLast4(accountNumber),
        ifsc: input.ifsc,
        swiftBic: input.swiftBic,
        branchCode: input.branchCode,
        branchName: input.branchName,
        branchAddress: input.branchAddress,
        currency: input.currency.toUpperCase(),
        isDefault: input.isDefault || existingCount === 0,
        isActive: input.isActive
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "company_bank_account.create",
        entityType: "company_bank_account",
        entityId: account.id
      }
    });

    return {
      ...account,
      maskedAccountNumber: maskAccountNumber(account.accountNumberLast4)
    };
  });
}
