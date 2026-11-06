import { AppShellClient, type ShellAccount } from "@/components/app-shell-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser, listActiveMemberships } from "@/lib/organisations/membership";

/** Loads the signed-in user's organisations and role, then renders the client sidebar layout. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  let account: ShellAccount | null = null;

  if (user) {
    const [context, memberships] = await Promise.all([
      getTenantContextForUser(user.id),
      listActiveMemberships(user.id)
    ]);
    account = {
      displayName: user.name || user.email,
      role: context?.role ?? null,
      activeOrganisationId: context?.organisationId ?? null,
      organisations: memberships.map((membership) => ({ id: membership.organisationId, name: membership.organisation.name }))
    };
  }

  return <AppShellClient account={account}>{children}</AppShellClient>;
}
