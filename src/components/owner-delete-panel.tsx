import { Trash2 } from "lucide-react";

/**
 * Owner-only "delete permanently" box shown at the foot of a document page. It posts to
 * /api/admin/purge, which re-checks the password (and the 2FA code when two-factor is on).
 */
export function OwnerDeletePanel({
  entity,
  id,
  label,
  twoFactorOn,
  consequences
}: {
  entity: "invoice" | "packing_list" | "credit_note";
  id: string;
  label: string;
  twoFactorOn: boolean;
  consequences: string;
}) {
  return (
    <details className="details top-space danger-zone panel">
      <summary><Trash2 size={16} /> Delete permanently (owner only)</summary>
      <form className="form top-space" action="/api/admin/purge" method="post">
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <p className="notice error">
          This permanently deletes <strong>{label}</strong>. {consequences} It cannot be undone, and the deletion is recorded in the audit log.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`purge-password-${id}`}>Your password</label>
            <input id={`purge-password-${id}`} name="password" type="password" required autoComplete="current-password" />
          </div>
          {twoFactorOn ? (
            <div className="field">
              <label htmlFor={`purge-code-${id}`}>Authenticator code</label>
              <input id={`purge-code-${id}`} name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={20} />
            </div>
          ) : null}
        </div>
        <label className="checkbox"><input type="checkbox" name="confirm" value="yes" required /> I understand this cannot be undone</label>
        <button className="button danger" type="submit"><Trash2 size={16} /> Delete permanently</button>
      </form>
    </details>
  );
}
