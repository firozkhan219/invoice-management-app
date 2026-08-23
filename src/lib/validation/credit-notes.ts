import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

export const creditNoteDraftSchema = z.object({
  originalInvoiceId: z.string().uuid(),
  reason: optionalText(5000)
});

export const creditNoteUpdateSchema = z.object({
  creditNoteId: z.string().uuid(),
  creditNoteDate: z.coerce.date(),
  reason: optionalText(5000)
});

export const creditNoteLineSchema = z.object({
  creditNoteId: z.string().uuid(),
  invoiceItemId: z.string().uuid(),
  quantity: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0)
});

export const creditNoteLineDeleteSchema = z.object({
  creditNoteId: z.string().uuid(),
  lineId: z.string().uuid()
});

export const creditNoteIssueSchema = z.object({
  creditNoteId: z.string().uuid(),
  seriesId: z.string().uuid()
});

export const creditNoteNumberSeriesSchema = z.object({
  companyId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  name: z.string().trim().min(2).max(120),
  pattern: z.string().trim().min(3).max(120),
  prefix: optionalText(40),
  padding: z.coerce.number().int().min(1).max(12).default(4),
  startingNumber: z.coerce.number().int().min(1).max(999999999).default(1),
  resetRule: z.enum(["never", "calendar_year", "financial_year"]).default("financial_year"),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export type CreditNoteDraftInput = z.infer<typeof creditNoteDraftSchema>;
export type CreditNoteUpdateInput = z.infer<typeof creditNoteUpdateSchema>;
export type CreditNoteLineInput = z.infer<typeof creditNoteLineSchema>;
export type CreditNoteLineDeleteInput = z.infer<typeof creditNoteLineDeleteSchema>;
export type CreditNoteIssueInput = z.infer<typeof creditNoteIssueSchema>;
export type CreditNoteNumberSeriesInput = z.infer<typeof creditNoteNumberSeriesSchema>;
