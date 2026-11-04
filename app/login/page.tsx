import Link from "next/link";
import { connection } from "next/server";
import { FlashMessage } from "@/components/flash-message";
import { isRegistrationOpen } from "@/lib/auth/auth-service";

export default async function LoginPage() {
  await connection();
  const registrationOpen = await isRegistrationOpen();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="muted">Invoice Management</p>
        <h1>Sign in</h1>
        <FlashMessage />
        <form className="form" action="/api/auth/login" method="post">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="button" type="submit">
            Sign in
          </button>
          {registrationOpen ? <Link href="/register">Create account</Link> : null}
        </form>
      </section>
    </main>
  );
}
