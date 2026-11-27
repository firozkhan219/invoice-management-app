import { getCurrentUser } from "@/lib/auth/session";
import { readResetBackup } from "@/lib/admin/purge-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

/** Owner only: downloads the JSON backup written before a reset. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  try {
    const { id } = await params;
    const backup = await readResetBackup(context, id);
    return new Response(new Uint8Array(backup.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup not available.";
    return Response.json({ ok: false, error: message }, { status: message.startsWith("Permission denied") ? 403 : 404 });
  }
}
