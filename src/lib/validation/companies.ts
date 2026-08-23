import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalStateCode = z.string()
  .trim()
  .max(10, "Use the GST state code, for example 09 for Uttar Pradesh.")
  .optional()
  .transform((value) => (value ? value : undefined));

export const companySchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  tradingName: optionalText(180),
  addressLine1: z.string().trim().min(2).max(180),
  addressLine2: optionalText(180),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  stateCode: optionalStateCode,
  postcode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80).default("India"),
  phone: optionalText(40),
  email: z.string().trim().email().max(320).optional().or(z.literal("")).transform((value) => value || undefined),
  gstin: optionalText(15),
  pan: optionalText(10),
  iec: optionalText(20),
  signatoryName: optionalText(160),
  signatoryDesignation: optionalText(120),
  defaultDeclaration: optionalText(5000),
  defaultTerms: optionalText(5000),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const bankAccountSchema = z.object({
  companyId: z.string().uuid(),
  bankName: z.string().trim().min(2).max(160),
  accountHolderName: z.string().trim().min(2).max(180),
  accountNumber: z.string().trim().min(4).max(40),
  ifsc: optionalText(11),
  swiftBic: optionalText(20),
  branchCode: optionalText(40),
  branchName: optionalText(120),
  branchAddress: optionalText(2000),
  currency: z.string().trim().length(3).default("INR"),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export type CompanyInput = z.infer<typeof companySchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
