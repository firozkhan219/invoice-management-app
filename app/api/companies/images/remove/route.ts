import { z } from "zod";
import { removeCompanyImage } from "@/lib/companies/company-service";
import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";

const schema = z.object({ companyId: z.string().uuid(), kind: z.enum(["logo", "signature"]) });

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/companies",
    handler: async ({ context, fields }) => {
      const input = parseForm(schema, fields);
      await removeCompanyImage(context, input.companyId, input.kind);
      return withFlash("/companies", "notice", input.kind === "logo" ? "Logo removed." : "Signature removed.");
    }
  });
}
