import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createCreditNoteDraft } from "@/lib/credit-notes/credit-note-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { creditNoteDraftSchema } from "@/lib/validation/credit-notes";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = creditNoteDraftSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  let destination = `/invoices/${parsed.data.originalInvoiceId}`;

  try {
    const creditNote = await createCreditNoteDraft(context, parsed.data);
    destination = `/credit-notes/${creditNote.id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create credit note draft.";
    destination = `/invoices/${parsed.data.originalInvoiceId}?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
