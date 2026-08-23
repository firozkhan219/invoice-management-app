import type { MemberRole } from "@/lib/permissions/roles";

export type TenantContext = {
  userId: string;
  organisationId: string;
  role: MemberRole;
};

export function requireTenantContext(context: TenantContext | null | undefined): TenantContext {
  if (!context?.userId || !context.organisationId || !context.role) {
    throw new Error("Tenant context is required");
  }

  return context;
}
