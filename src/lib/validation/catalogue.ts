import { z } from "zod";
import { CATALOGUE_FIELDS, type CatalogueFieldKey } from "@/lib/catalogue/catalogue-fields";

const fieldKeys = CATALOGUE_FIELDS.map((field) => field.key) as [CatalogueFieldKey, ...CatalogueFieldKey[]];

/** Parsed from the catalogue form (repeated checkbox fields arrive as arrays). */
export const cataloguePdfSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, "Select at least one product.").max(500, "A catalogue can have up to 500 products."),
  fields: z.array(z.enum(fieldKeys)).min(1, "Tick at least one detail to print."),
  layout: z.coerce.number().refine((value) => value === 1 || value === 2 || value === 4, "Choose 1, 2 or 4 photos per page.")
    .transform((value) => value as 1 | 2 | 4),
  title: z.string().trim().max(120).optional().transform((value) => value || undefined),
  companyId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  showLogo: z.boolean()
});

export type CataloguePdfInput = z.infer<typeof cataloguePdfSchema>;
