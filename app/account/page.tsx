import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">{user.email}</p>
          <h1>My account</h1>
        </div>
      </header>
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="muted">Security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <form className="form" action="/api/account/password" method="post">
          <div className="field"><label htmlFor="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" /></div>
          <div className="field"><label htmlFor="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" minLength={10} required autoComplete="new-password" /></div>
          <div className="field"><label htmlFor="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" /></div>
          <button className="button" type="submit">Change password</button>
        </form>
      </section>
    </AppShell>
  );
}
