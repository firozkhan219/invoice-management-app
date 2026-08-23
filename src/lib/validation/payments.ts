import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);

export const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3).default("INR").transform((value) => value.toUpperCase()),
  paymentMethod: z.string().trim().min(2).max(80),
  referenceNumber: optionalText(160),
  bankAccountId: optionalUuid,
  notes: optionalText(2000),
  idempotencyKey: optionalText(120)
});

export const reversePaymentSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000)
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
