import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createBuyerAddress } from "@/lib/buyers/buyer-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { buyerAddressSchema } from "@/lib/validation/buyers";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });
  }

  const parsed = buyerAddressSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await createBuyerAddress(context, parsed.data);
  redirect("/buyers");
}
