import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createInvoiceDraft, updateInvoiceDraft } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { invoiceDraftSchema } from "@/lib/validation/invoices";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const data = Object.fromEntries(await request.formData());
  const invoiceId = typeof data.invoiceId === "string" ? data.invoiceId : undefined;
  delete data.invoiceId;
  const parsed = invoiceDraftSchema.safeParse(data);
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  const invoice = invoiceId
    ? await updateInvoiceDraft(context, invoiceId, parsed.data)
    : await createInvoiceDraft(context, parsed.data);

  redirect(`/invoices/${invoice.id}`);
}
