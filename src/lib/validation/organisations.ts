import { z } from "zod";

export const createOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(180)
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
