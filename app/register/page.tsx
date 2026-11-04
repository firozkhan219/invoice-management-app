import Link from "next/link";
import { connection } from "next/server";
import { FlashMessage } from "@/components/flash-message";
import { isRegistrationOpen } from "@/lib/auth/auth-service";

export default async function RegisterPage() {
  await connection();
  if (!(await isRegistrationOpen())) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="muted">Invoice Management</p>
          <h1>Registration is closed</h1>
          <p className="muted">Ask an owner or admin of your organisation to add you from Users &amp; Roles.</p>
          <Link href="/login">Sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="muted">Invoice Management</p>
        <h1>Create account</h1>
        <FlashMessage />
        <form className="form" action="/api/auth/register" method="post">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="organisationName">Organisation name</label>
            <input id="organisationName" name="organisationName" required />
          </div>
          <button className="button" type="submit">
            Create organisation
          </button>
          <Link href="/login">Sign in</Link>
        </form>
      </section>
    </main>
  );
}
