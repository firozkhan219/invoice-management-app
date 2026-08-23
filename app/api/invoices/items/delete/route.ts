import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteInvoiceItem } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { invoiceItemDeleteSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = invoiceItemDeleteSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    await deleteInvoiceItem(context, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete invoice line.";
    redirect(`/invoices/${parsed.data.invoiceId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/invoices/${parsed.data.invoiceId}`);
}
