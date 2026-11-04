import { LogOut } from "lucide-react";
import { FlashMessage } from "@/components/flash-message";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser, listActiveMemberships } from "@/lib/organisations/membership";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const context = user ? await getTenantContextForUser(user.id) : null;
  const memberships = user ? await listActiveMemberships(user.id) : [];
  const active = memberships.find((membership) => membership.organisationId === context?.organisationId);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IM</span>
          <span>Invoice Management</span>
        </div>
        <AppNav />
        {user ? (
          <div className="sidebar-account">
            {memberships.length > 1 ? (
              <form action="/api/organisations/switch" method="post" className="form compact-form">
                <label htmlFor="organisation-switch" className="muted">Organisation</label>
                <select id="organisation-switch" name="organisationId" defaultValue={context?.organisationId}>
                  {memberships.map((membership) => (
                    <option key={membership.organisationId} value={membership.organisationId}>
                      {membership.organisation.name}
                    </option>
                  ))}
                </select>
                <button className="button subtle" type="submit">Switch</button>
              </form>
            ) : active ? (
              <p className="muted">{active.organisation.name}</p>
            ) : null}
            <p className="muted">
              {user.name || user.email}
              {context ? ` · ${context.role}` : ""}
            </p>
            <form action="/api/auth/logout" method="post">
              <button className="button subtle" type="submit">
                <LogOut size={16} />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </aside>
      <section className="content">
        <FlashMessage />
        {children}
      </section>
    </main>
  );
}
