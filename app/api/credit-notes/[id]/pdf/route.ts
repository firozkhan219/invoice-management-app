import { getCurrentUser } from "@/lib/auth/session";
import { generateCreditNotePdf } from "@/lib/credit-notes/credit-note-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });
  const { id } = await params;

  try {
    const { buffer, filename } = await generateCreditNotePdf(context, id);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate credit note PDF.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
