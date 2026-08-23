import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { issueInvoice } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { issueInvoiceSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const parsed = issueInvoiceSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  let destination: string;

  try {
    const invoice = await issueInvoice(context, parsed.data);
    destination = `/invoices/${invoice.id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice could not be issued.";
    destination = `/invoices/${parsed.data.invoiceId}?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
