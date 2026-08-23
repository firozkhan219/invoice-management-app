import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const organisationSettingsSchema = z.object({
  defaultCompanyId: optionalUuid,
  defaultBankAccountId: optionalUuid,
  defaultInvoiceTitle: z.string().trim().min(1).max(120).default("Tax Invoice"),
  defaultTaxMode: z.enum(["automatic", "igst", "cgst_sgst", "zero_rated_export", "no_tax"]).default("automatic"),
  roundingPolicy: z.enum(["none", "nearest_rupee", "two_decimals"]).default("nearest_rupee"),
  defaultDeclaration: optionalText(5000),
  defaultNotes: optionalText(5000),
  paymentTerms: optionalText(5000),
  deliveryTerms: optionalText(5000),
  pdfFooter: optionalText(5000),
  showPageNumbers: z.coerce.boolean().default(false),
  draftAutosave: z.coerce.boolean().default(false),
  numberOnIssue: z.coerce.boolean().default(false),
  allowManualNumberOverride: z.coerce.boolean().default(false),
  allowManualDateOverride: z.coerce.boolean().default(false)
});

export const lockedPeriodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  reason: z.string().trim().min(3).max(5000),
  isActive: z.coerce.boolean().default(true)
}).refine((value) => value.endsOn >= value.startsOn, {
  path: ["endsOn"],
  message: "End date must be after start date."
});

export const numberSeriesSchema = z.object({
  companyId: optionalUuid,
  name: z.string().trim().min(2).max(120),
  pattern: z.string().trim().min(3).max(120),
  prefix: optionalText(40),
  padding: z.coerce.number().int().min(1).max(12).default(4),
  startingNumber: z.coerce.number().int().min(1).max(999999999).default(1),
  resetRule: z.enum(["never", "calendar_year", "financial_year"]).default("financial_year"),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const numberSeriesActionSchema = z.object({
  seriesId: z.string().uuid(),
  action: z.enum(["make_default", "deactivate"])
});

export type OrganisationSettingsInput = z.infer<typeof organisationSettingsSchema>;
export type LockedPeriodInput = z.infer<typeof lockedPeriodSchema>;
export type NumberSeriesInput = z.infer<typeof numberSeriesSchema>;
export type NumberSeriesActionInput = z.infer<typeof numberSeriesActionSchema>;
