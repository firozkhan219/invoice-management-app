import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { invoiceRegisterCsv } from "@/lib/reports/invoice-register";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const url = new URL(request.url);
  const csv = await invoiceRegisterCsv(context, {
    q: url.searchParams.get("q") || undefined,
    status: url.searchParams.get("status") || undefined,
    currency: url.searchParams.get("currency") || undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"invoice-register.csv\"",
      "Cache-Control": "private, no-store"
    }
  });
}
