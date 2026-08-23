import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);

export const invoiceDraftSchema = z.object({
  companyId: optionalUuid,
  buyerId: optionalUuid,
  consigneeBuyerId: optionalUuid,
  billingAddressId: optionalUuid,
  shippingAddressId: optionalUuid,
  bankAccountId: optionalUuid,
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  currency: z.string().trim().length(3).default("INR").transform((value) => value.toUpperCase()),
  placeOfSupplyStateCode: optionalText(10),
  taxMode: z.enum(["automatic", "igst", "cgst_sgst", "zero_rated_export", "no_tax"]).default("automatic"),
  buyerOrderNumber: optionalText(120),
  buyerOrderDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  exporterReference: optionalText(120),
  preCarriageBy: optionalText(120),
  placeOfReceipt: optionalText(120),
  vesselFlightNo: optionalText(120),
  portOfLoading: optionalText(120),
  portOfDischarge: optionalText(120),
  finalDestination: optionalText(120),
  termsOfDelivery: optionalText(5000),
  notes: optionalText(5000),
  declaration: optionalText(5000),
  invoiceDiscount: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  version: z.coerce.number().int().min(1).optional()
});

export const invoiceItemSchema = z.object({
  invoiceId: z.string().uuid(),
  itemId: optionalUuid,
  sortOrder: z.coerce.number().int().min(1).default(1),
  sku: optionalText(80),
  description: z.string().trim().min(1).max(5000),
  hsnSac: optionalText(20),
  quantity: z.coerce.number().min(0),
  unitCode: optionalText(20),
  rate: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  expectedVersion: z.coerce.number().int().min(1)
});

export const invoiceItemUpdateSchema = invoiceItemSchema.extend({
  lineItemId: z.string().uuid()
});

export const invoiceItemDeleteSchema = z.object({
  invoiceId: z.string().uuid(),
  lineItemId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1)
});

export const issueInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  seriesId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1)
});

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(5000)
});

export const deleteDraftInvoiceSchema = z.object({
  invoiceId: z.string().uuid()
});

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceItemUpdateInput = z.infer<typeof invoiceItemUpdateSchema>;
export type InvoiceItemDeleteInput = z.infer<typeof invoiceItemDeleteSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type DeleteDraftInvoiceInput = z.infer<typeof deleteDraftInvoiceSchema>;
