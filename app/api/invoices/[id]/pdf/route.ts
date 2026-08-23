import { getCurrentUser } from "@/lib/auth/session";
import { generateInvoicePdf } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  try {
    const { id } = await params;
    const pdf = await generateInvoicePdf(context, id);

    return new Response(new Uint8Array(pdf.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.filename}"`,
        "Content-Length": String(pdf.buffer.byteLength),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "PDF generation failed."
    }, { status: 400 });
  }
}
