import { getCurrentUser } from "@/lib/auth/session";
import { generateCataloguePdf } from "@/lib/catalogue/catalogue-service";
import { seeOther, userFacingMessage, withFlash } from "@/lib/http/form";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { cataloguePdfSchema } from "@/lib/validation/catalogue";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return seeOther("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) return seeOther("/login");

  const form = await request.formData();
  const parsed = cataloguePdfSchema.safeParse({
    itemIds: form.getAll("itemIds").map(String),
    fields: form.getAll("fields").map(String),
    layout: form.get("layout"),
    title: form.get("title") ?? undefined,
    companyId: form.get("companyId") ?? undefined,
    showLogo: form.get("showLogo") === "on"
  });
  if (!parsed.success) return seeOther(withFlash("/catalogue", "error", parsed.error.issues[0]?.message ?? "Check your choices and try again."));

  try {
    const { buffer, filename } = await generateCataloguePdf(context, parsed.data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return seeOther(withFlash("/catalogue", "error", userFacingMessage(error, "The catalogue could not be created.")));
  }
}
