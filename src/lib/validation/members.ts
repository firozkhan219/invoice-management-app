import { z } from "zod";

const role = z.enum(["owner", "admin", "accountant", "viewer"]);
const password = z.string().min(10, "Password must be at least 10 characters.").max(128);

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().max(160).optional().transform((value) => value || undefined),
  role,
  initialPassword: z.union([z.literal(""), password]).optional().transform((value) => value || undefined)
});

export const updateMemberSchema = z.object({
  memberId: z.string().uuid(),
  role,
  status: z.enum(["active", "suspended"])
});

export const resetMemberPasswordSchema = z.object({
  memberId: z.string().uuid(),
  newPassword: password
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const switchOrganisationSchema = z.object({
  organisationId: z.string().uuid()
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type ResetMemberPasswordInput = z.infer<typeof resetMemberPasswordSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
