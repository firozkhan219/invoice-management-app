import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/repositories/tenant-context";

export const ACTIVE_ORG_COOKIE = "active_org";

async function preferredOrganisationId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_ORG_COOKIE)?.value || undefined;
  } catch {
    // Called outside a request (scripts/tests).
    return undefined;
  }
}

/**
 * Resolves the organisation the user is working in: the explicit id, else the one chosen
 * with the organisation switcher (cookie), else their oldest active membership.
 */
export async function getTenantContextForUser(
  userId: string,
  organisationId?: string
): Promise<TenantContext | null> {
  const requested = organisationId ?? (await preferredOrganisationId());

  const membership =
    (requested
      ? await prisma.organisationMember.findFirst({
          where: { userId, status: "active", organisationId: requested }
        })
      : null) ??
    (organisationId
      ? null
      : await prisma.organisationMember.findFirst({
          where: { userId, status: "active" },
          orderBy: { createdAt: "asc" }
        }));

  if (!membership) {
    return null;
  }

  return {
    userId,
    organisationId: membership.organisationId,
    role: membership.role
  };
}

export async function listActiveMemberships(userId: string) {
  return prisma.organisationMember.findMany({
    where: { userId, status: "active" },
    include: { organisation: true },
    orderBy: { createdAt: "asc" }
  });
}
