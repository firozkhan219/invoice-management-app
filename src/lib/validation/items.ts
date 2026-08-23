import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const unitSchema = z.object({
  code: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  precision: z.coerce.number().int().min(0).max(6).default(2),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const taxRateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rate: z.coerce.number().min(0).max(100),
  taxType: z.enum(["gst", "export_zero_rated", "no_tax"]).default("gst"),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const itemSchema = z.object({
  sku: optionalText(80),
  name: z.string().trim().min(1).max(180),
  description: optionalText(5000),
  hsnSac: optionalText(20),
  unitId: optionalUuid,
  taxRateId: optionalUuid,
  saleRate: z.coerce.number().min(0).max(999999999999).optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  currency: z.string().trim().length(3).default("INR").transform((value) => value.toUpperCase()),
  isActive: z.coerce.boolean().default(true)
});

export type UnitInput = z.infer<typeof unitSchema>;
export type TaxRateInput = z.infer<typeof taxRateSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
