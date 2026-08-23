import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createBankAccount } from "@/lib/companies/company-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { bankAccountSchema } from "@/lib/validation/companies";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });
  }

  const parsed = bankAccountSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await createBankAccount(context, parsed.data);
  redirect("/companies");
}
