import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTwoFactorStatus, readStashedRecoveryCodes } from "@/lib/auth/two-factor-service";
import { formatSetupKey, totpUri } from "@/lib/security/totp";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const twoFactor = await getTwoFactorStatus(user.id);
  const recoveryCodes = await readStashedRecoveryCodes();

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

      <section className="panel top-space" id="two-factor">
        <div className="section-title">
          <div>
            <p className="muted">Security</p>
            <h2>Two-factor authentication</h2>
          </div>
          <span className={twoFactor.enabled ? "badge" : "badge neutral"}>{twoFactor.enabled ? "On" : "Off"}</span>
        </div>

        {recoveryCodes ? (
          <div className="notice recovery-codes">
            <strong>Your recovery codes — save them now, they are shown only once.</strong>
            <p>Each code signs you in once if you lose your phone. Keep them somewhere safe, away from this computer.</p>
            <ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
          </div>
        ) : null}

        {twoFactor.enabled ? (
          <>
            <p className="muted">
              Sign-in asks for a code from your authenticator app. On since {twoFactor.enabledAt?.toISOString().slice(0, 10)} ·{" "}
              {twoFactor.recoveryCodesLeft} recovery codes left.
            </p>
            <div className="grid two-column">
              <form className="form" action="/api/account/2fa" method="post">
                <input type="hidden" name="action" value="regenerate" />
                <h3>New recovery codes</h3>
                <div className="field"><label htmlFor="regenPassword">Password</label><input id="regenPassword" name="password" type="password" required autoComplete="current-password" /></div>
                <div className="field"><label htmlFor="regenCode">Authenticator code</label><input id="regenCode" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={20} /></div>
                <button className="button subtle" type="submit">Issue new recovery codes</button>
              </form>
              <form className="form" action="/api/account/2fa" method="post">
                <input type="hidden" name="action" value="disable" />
                <h3>Turn off</h3>
                <div className="field"><label htmlFor="offPassword">Password</label><input id="offPassword" name="password" type="password" required autoComplete="current-password" /></div>
                <div className="field"><label htmlFor="offCode">Authenticator code</label><input id="offCode" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={20} /></div>
                <button className="button danger" type="submit">Turn off two-factor</button>
              </form>
            </div>
          </>
        ) : twoFactor.pendingSecret ? (
          <div className="stack">
            <ol className="steps">
              <li>Open Google Authenticator, Microsoft Authenticator or Authy on your phone and choose <strong>Add account → Enter a setup key</strong>.</li>
              <li>Account name: <strong>{twoFactor.email}</strong>. Key: <code className="setup-key">{formatSetupKey(twoFactor.pendingSecret)}</code> (time based).</li>
              <li>Or, on the phone itself, tap <a href={totpUri(twoFactor.pendingSecret, twoFactor.email, "Invoice Management")}>this setup link</a>.</li>
              <li>Enter the 6-digit code the app shows below.</li>
            </ol>
            <form className="form" action="/api/account/2fa" method="post">
              <input type="hidden" name="action" value="confirm" />
              <div className="field"><label htmlFor="confirmCode">6-digit code</label><input id="confirmCode" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" /></div>
              <button className="button" type="submit">Turn on two-factor</button>
            </form>
          </div>
        ) : (
          <form className="form" action="/api/account/2fa" method="post">
            <input type="hidden" name="action" value="start" />
            <p className="muted">Adds a second step to sign-in: a 6-digit code from an authenticator app on your phone. Required before an owner can reset the data.</p>
            <div className="field"><label htmlFor="startPassword">Confirm your password</label><input id="startPassword" name="password" type="password" required autoComplete="current-password" /></div>
            <button className="button" type="submit">Set up two-factor</button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
