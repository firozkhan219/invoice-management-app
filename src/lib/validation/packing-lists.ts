import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);
const optionalNumber = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().min(0).optional());
const optionalInt = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().int().min(1).max(99999).optional());
const optionalDate = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.date().optional());

export const packingListDraftSchema = z.object({
  invoiceId: optionalUuid,
  companyId: optionalUuid,
  buyerId: optionalUuid,
  consigneeBuyerId: optionalUuid,
  packingListDate: z.coerce.date(),
  exportReference: optionalText(120),
  containerNumber: optionalText(120),
  sealNumber: optionalText(120),
  shipmentMode: optionalText(80),
  portOfLoading: optionalText(120),
  portOfDischarge: optionalText(120),
  finalDestination: optionalText(120),
  buyerOrderNumber: optionalText(120),
  buyerOrderDate: optionalDate,
  preCarriageBy: optionalText(120),
  placeOfReceipt: optionalText(120),
  vesselFlightNo: optionalText(120),
  termsOfDelivery: optionalText(2000),
  countryOfOrigin: optionalText(80),
  countryOfFinalDestination: optionalText(80),
  notes: optionalText(5000),
  version: z.coerce.number().int().min(1).optional()
});

export const packingListLineSchema = z.object({
  packingListId: z.string().uuid(),
  itemId: optionalUuid,
  invoiceItemId: optionalUuid,
  sortOrder: z.coerce.number().int().min(1).default(1),
  packageNo: optionalText(80),
  // Carton-wise lines: "2 to 8" cartons, 10 pcs each, 0.640 kg net per piece, 9 kg gross per carton.
  cartonFrom: optionalInt,
  cartonTo: optionalInt,
  piecesPerCarton: optionalNumber,
  netWeightPerPieceKg: optionalNumber,
  grossWeightPerCartonKg: optionalNumber,
  marksAndNumbers: optionalText(160),
  sku: optionalText(80),
  description: z.string().trim().min(1).max(5000),
  hsnSac: optionalText(20),
  // Totals may be left blank when pcs/carton and weights per piece/carton are given; they are worked out.
  quantity: z.preprocess((value) => (value === "" || value === null || value === undefined ? 0 : value), z.coerce.number().min(0)),
  unitCode: optionalText(20),
  netWeightKg: z.preprocess((value) => (value === "" || value === null || value === undefined ? 0 : value), z.coerce.number().min(0)),
  grossWeightKg: z.preprocess((value) => (value === "" || value === null || value === undefined ? 0 : value), z.coerce.number().min(0)),
  lengthCm: optionalNumber,
  widthCm: optionalNumber,
  heightCm: optionalNumber,
  expectedVersion: z.coerce.number().int().min(1)
});

/** One box line on the one-page packing list form (no packing list id yet). */
export const quickPackingLineSchema = packingListLineSchema.omit({ packingListId: true, expectedVersion: true, sortOrder: true });

export const packingListLineDeleteSchema = z.object({
  packingListId: z.string().uuid(),
  lineId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1)
});

export const packingListIssueSchema = z.object({
  packingListId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1)
});

export const packingListLineUpdateSchema = packingListLineSchema
  .omit({ itemId: true, invoiceItemId: true })
  .extend({ lineId: z.string().uuid() });

export const packingListStatusSchema = z.object({
  packingListId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  reason: optionalText(500)
});

export type PackingListDraftInput = z.infer<typeof packingListDraftSchema>;
export type PackingListLineInput = z.infer<typeof packingListLineSchema>;
export type QuickPackingLineInput = z.infer<typeof quickPackingLineSchema>;
export type PackingListLineDeleteInput = z.infer<typeof packingListLineDeleteSchema>;
export type PackingListIssueInput = z.infer<typeof packingListIssueSchema>;
export type PackingListLineUpdateInput = z.infer<typeof packingListLineUpdateSchema>;
export type PackingListStatusInput = z.infer<typeof packingListStatusSchema>;
