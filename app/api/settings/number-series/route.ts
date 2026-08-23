import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { createNumberSeries, updateNumberSeriesAction } from "@/lib/settings/settings-service";
import { numberSeriesActionSchema, numberSeriesSchema } from "@/lib/validation/settings";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });

  const context = await getTenantContextForUser(user.id);
  if (!context) return Response.json({ ok: false, error: "No active organisation." }, { status: 403 });

  const data = Object.fromEntries(await request.formData());
  const action = typeof data.action === "string" ? data.action : undefined;

  let destination = "/settings";

  try {
    if (action) {
      const parsed = numberSeriesActionSchema.safeParse(data);
      if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
      await updateNumberSeriesAction(context, parsed.data);
    } else {
      const parsed = numberSeriesSchema.safeParse(data);
      if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
      await createNumberSeries(context, parsed.data);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Number series could not be updated.";
    destination = `/settings?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
