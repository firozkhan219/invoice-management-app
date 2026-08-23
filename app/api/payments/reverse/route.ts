import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { reversePayment } from "@/lib/payments/payment-service";
import { reversePaymentSchema } from "@/lib/validation/payments";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = reversePaymentSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  let destination = "/payments";
  try {
    await reversePayment(context, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment could not be reversed.";
    destination = `/payments?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
