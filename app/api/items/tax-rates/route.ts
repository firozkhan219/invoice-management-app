import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createTaxRate } from "@/lib/items/item-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { taxRateSchema } from "@/lib/validation/items";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = taxRateSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  await createTaxRate(context, parsed.data);
  redirect("/items");
}
