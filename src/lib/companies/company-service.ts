import { prisma } from "@/lib/db/prisma";
import { accountLast4, maskAccountNumber, normaliseAccountNumber } from "@/lib/companies/bank-account";
import { encryptSensitiveText } from "@/lib/security/encryption";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { storeCompanyImage } from "@/lib/files/file-assets";
import type {
  BankAccountInput,
  BankAccountUpdateInput,
  CompanyInput,
  CompanyToggleInput,
  CompanyUpdateInput
} from "@/lib/validation/companies";

export async function listCompanies(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId },
    include: {
      bankAccounts: {
        orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { legalName: "asc" }]
  });

  return companies.map((company) => ({
    ...company,
    bankAccounts: company.bankAccounts.map((account) => ({
      ...withoutCiphertext(account),
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

function withoutCiphertext<T extends { accountNumberCiphertext: string; accountNumberIv: string; accountNumberTag: string }>(
  account: T
): Omit<T, "accountNumberCiphertext" | "accountNumberIv" | "accountNumberTag"> {
  const copy: Partial<T> = { ...account };
  delete copy.accountNumberCiphertext;
  delete copy.accountNumberIv;
  delete copy.accountNumberTag;
  return copy as Omit<T, "accountNumberCiphertext" | "accountNumberIv" | "accountNumberTag">;
}

function nulls(keys: readonly string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

export async function updateCompany(
  context: TenantContext,
  input: CompanyUpdateInput,
  clear: readonly string[] = [],
  images: { logo?: File; signature?: File } = {}
) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  const current = await prisma.company.findFirst({
    where: { id: input.companyId, organisationId: tenant.organisationId }
  });
  if (!current) throw new Error("Company not found.");

  // Files are written before the transaction; an orphaned file after a later failure is harmless.
  const logo = images.logo ? await storeCompanyImage(tenant, images.logo, "company_logo") : null;
  const signature = images.signature ? await storeCompanyImage(tenant, images.signature, "company_signature") : null;

  return prisma.$transaction(async (tx) => {
    const { companyId, ...fields } = input;

    if (fields.isDefault) {
      await tx.company.updateMany({
        where: { organisationId: tenant.organisationId, NOT: { id: companyId } },
        data: { isDefault: false }
      });
    }

    const company = await tx.company.update({
      where: { id: current.id },
      data: {
        ...fields,
        ...nulls(clear),
        isDefault: fields.isDefault && current.isActive,
        ...(logo ? { logoAssetId: logo.id } : {}),
        ...(signature ? { signatureAssetId: signature.id } : {})
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "company.update",
        entityType: "company",
        entityId: company.id,
        metadata: { logoUpdated: Boolean(logo), signatureUpdated: Boolean(signature) }
      }
    });

    return company;
  });
}

export async function removeCompanyImage(context: TenantContext, companyId: string, kind: "logo" | "signature") {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({ where: { id: companyId, organisationId: tenant.organisationId } });
    if (!company) throw new Error("Company not found.");
    const updated = await tx.company.update({
      where: { id: company.id },
      data: kind === "logo" ? { logoAssetId: null } : { signatureAssetId: null }
    });
    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: kind === "logo" ? "company.logo_remove" : "company.signature_remove",
        entityType: "company",
        entityId: company.id
      }
    });
    return updated;
  });
}

export async function updateBankAccount(context: TenantContext, input: BankAccountUpdateInput, clear: readonly string[] = []) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const current = await tx.companyBankAccount.findFirst({
      where: { id: input.bankAccountId, organisationId: tenant.organisationId }
    });
    if (!current) throw new Error("Bank account not found.");

    const { bankAccountId, accountNumber, ...fields } = input;
    let accountFields = {};
    if (accountNumber) {
      const normalised = normaliseAccountNumber(accountNumber);
      const encrypted = encryptSensitiveText(normalised);
      accountFields = {
        accountNumberCiphertext: encrypted.ciphertext,
        accountNumberIv: encrypted.iv,
        accountNumberTag: encrypted.tag,
        accountNumberLast4: accountLast4(normalised)
      };
    }

    if (fields.isDefault) {
      await tx.companyBankAccount.updateMany({
        where: { organisationId: tenant.organisationId, companyId: current.companyId, NOT: { id: bankAccountId } },
        data: { isDefault: false }
      });
    }

    const account = await tx.companyBankAccount.update({
      where: { id: current.id },
      data: {
        ...fields,
        ...nulls(clear),
        ...accountFields,
        currency: fields.currency.toUpperCase(),
        isDefault: fields.isDefault && current.isActive
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "company_bank_account.update",
        entityType: "company_bank_account",
        entityId: account.id,
        metadata: { accountNumberChanged: Boolean(accountNumber) }
      }
    });

    return { id: account.id, companyId: account.companyId };
  });
}

/** Soft activate/deactivate. Deactivating also clears the default flag. */
export async function setCompanyMasterActive(context: TenantContext, input: CompanyToggleInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");

  return prisma.$transaction(async (tx) => {
    const data = input.active ? { isActive: true } : { isActive: false, isDefault: false };
    const entityType = input.kind === "company" ? "company" : "company_bank_account";

    if (input.kind === "company") {
      const found = await tx.company.findFirst({ where: { id: input.id, organisationId: tenant.organisationId } });
      if (!found) throw new Error("Company not found.");
      await tx.company.update({ where: { id: found.id }, data });
    } else {
      const found = await tx.companyBankAccount.findFirst({ where: { id: input.id, organisationId: tenant.organisationId } });
      if (!found) throw new Error("Bank account not found.");
      await tx.companyBankAccount.update({ where: { id: found.id }, data });
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
