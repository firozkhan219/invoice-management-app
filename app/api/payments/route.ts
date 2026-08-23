import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { recordPayment } from "@/lib/payments/payment-service";
import { paymentSchema } from "@/lib/validation/payments";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = paymentSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  let destination = "/payments";
  try {
    await recordPayment(context, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment could not be recorded.";
    destination = `/payments?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
