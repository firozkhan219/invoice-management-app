import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listMembers } from "@/lib/organisations/member-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";

const roles = ["owner", "admin", "accountant", "viewer"] as const;

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login");

  if (!hasPermission(context.role, "members:read")) {
    return (
      <AppShell>
        <header className="page-header"><div><p className="muted">Organisation</p><h1>Users &amp; Roles</h1></div></header>
        <div className="empty-state">Only owners and admins can see the member list.</div>
      </AppShell>
    );
  }

  const members = await listMembers(context);
  const canManage = hasPermission(context.role, "members:manage");
  const assignableRoles = roles.filter((role) => role !== "owner" || context.role === "owner");

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Organisation</p>
          <h1>Users &amp; Roles</h1>
        </div>
      </header>
      <div className="grid two-column">
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="muted">Access</p>
              <h2>{members.length} members</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th>{canManage ? <th>Manage</th> : null}</tr></thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.userId === context.userId;
                  const lockedOwner = member.role === "owner" && context.role !== "owner";
                  return (
                    <tr key={member.id}>
                      <td>{member.user.name || "-"}{isSelf ? " (you)" : ""}</td>
                      <td>{member.user.email}</td>
                      <td>{member.role}</td>
                      <td><span className="badge">{member.status}</span></td>
                      {canManage ? (
                        <td>
                          {isSelf || lockedOwner ? "-" : (
                            <div className="line-actions">
                              <details className="details compact">
                                <summary>Edit</summary>
                                <form className="form compact-form" action="/api/members/update" method="post">
                                  <input type="hidden" name="memberId" value={member.id} />
                                  <div className="field">
                                    <label htmlFor={`role-${member.id}`}>Role</label>
                                    <select id={`role-${member.id}`} name="role" defaultValue={member.role}>
                                      {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                                    </select>
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`status-${member.id}`}>Status</label>
                                    <select id={`status-${member.id}`} name="status" defaultValue={member.status === "active" ? "active" : "suspended"}>
                                      <option value="active">active</option>
                                      <option value="suspended">suspended</option>
                                    </select>
                                  </div>
                                  <button className="button" type="submit">Save</button>
                                </form>
                              </details>
                              <details className="details compact">
                                <summary>Reset password</summary>
                                <form className="form compact-form" action="/api/members/reset-password" method="post">
                                  <input type="hidden" name="memberId" value={member.id} />
                                  <div className="field">
                                    <label htmlFor={`pw-${member.id}`}>New password</label>
                                    <input id={`pw-${member.id}`} name="newPassword" type="password" minLength={10} required autoComplete="new-password" />
                                  </div>
                                  <button className="button danger" type="submit">Reset</button>
                                </form>
                              </details>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {canManage ? (
          <aside className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Invite</p>
                <h2>Add member</h2>
              </div>
            </div>
            <form className="form" action="/api/members" method="post">
              <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
              <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" /></div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="accountant">
                  {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="initialPassword">Initial password (only for new accounts)</label>
                <input id="initialPassword" name="initialPassword" type="password" minLength={10} autoComplete="new-password" />
                <p className="muted">Share it privately. They should change it under My account after signing in.</p>
              </div>
              <button className="button" type="submit">Add member</button>
            </form>
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}
