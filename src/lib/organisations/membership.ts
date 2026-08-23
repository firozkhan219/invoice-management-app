import { prisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/repositories/tenant-context";

export async function getTenantContextForUser(
  userId: string,
  organisationId?: string
): Promise<TenantContext | null> {
  const membership = await prisma.organisationMember.findFirst({
    where: {
      userId,
      status: "active",
      ...(organisationId ? { organisationId } : {})
    },
    orderBy: { createdAt: "asc" }
  });

  if (!membership) {
    return null;
  }

  return {
    userId,
    organisationId: membership.organisationId,
    role: membership.role
  };
}
