import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalEmail = z
  .string()
  .trim()
  .email()
  .max(320)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2).max(180),
  legalName: optionalText(180),
  contactPerson: optionalText(160),
  phone: optionalText(40),
  email: optionalEmail,
  gstin: optionalText(15),
  pan: optionalText(10),
  iec: optionalText(20),
  customerReference: optionalText(80),
  notes: optionalText(5000),
  isActive: z.coerce.boolean().default(true)
});

export const buyerAddressSchema = z.object({
  buyerId: z.string().uuid(),
  label: z.string().trim().min(2).max(120),
  contactPerson: optionalText(160),
  phone: optionalText(40),
  email: optionalEmail,
  addressLine1: z.string().trim().min(2).max(180),
  addressLine2: optionalText(180),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  stateCode: optionalText(10),
  postcode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80).default("India"),
  isBillingDefault: z.coerce.boolean().default(false),
  isShippingDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export type BuyerInput = z.infer<typeof buyerSchema>;
export type BuyerAddressInput = z.infer<typeof buyerAddressSchema>;

const uuid = z.string().uuid();

export const buyerUpdateSchema = buyerSchema.omit({ isActive: true }).extend({ buyerId: uuid });

export const buyerAddressUpdateSchema = buyerAddressSchema.omit({ isActive: true, buyerId: true }).extend({ addressId: uuid });

export const buyerToggleSchema = z.object({
  kind: z.enum(["buyer", "address"]),
  id: uuid,
  active: z.enum(["true", "false"]).transform((value) => value === "true")
});

export const BUYER_CLEARABLE_FIELDS = [
  "legalName", "contactPerson", "phone", "email", "gstin", "pan", "iec", "customerReference", "notes"
] as const;

export const BUYER_ADDRESS_CLEARABLE_FIELDS = ["contactPerson", "phone", "email", "addressLine2", "stateCode"] as const;

export type BuyerUpdateInput = z.infer<typeof buyerUpdateSchema>;
export type BuyerAddressUpdateInput = z.infer<typeof buyerAddressUpdateSchema>;
export type BuyerToggleInput = z.infer<typeof buyerToggleSchema>;
