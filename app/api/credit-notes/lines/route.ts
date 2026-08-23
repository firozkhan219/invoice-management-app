import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { addCreditNoteLine } from "@/lib/credit-notes/credit-note-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { creditNoteLineSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = creditNoteLineSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    await addCreditNoteLine(context, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add credit note line.";
    redirect(`/credit-notes/${parsed.data.creditNoteId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/credit-notes/${parsed.data.creditNoteId}`);
}
