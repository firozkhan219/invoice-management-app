import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { seeOther, withFlash } from "@/lib/http/form";
import { ACTIVE_ORG_COOKIE, getTenantContextForUser } from "@/lib/organisations/membership";
import { switchOrganisationSchema } from "@/lib/validation/members";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return seeOther("/login");

  const parsed = switchOrganisationSchema.safeParse(Object.fromEntries(await request.formData()));
  const context = parsed.success ? await getTenantContextForUser(user.id, parsed.data.organisationId) : null;
  if (!context) return seeOther(withFlash("/dashboard", "error", "You are not an active member of that organisation."));

  (await cookies()).set(ACTIVE_ORG_COOKIE, context.organisationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return seeOther("/dashboard");
}
