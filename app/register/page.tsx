import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="muted">Invoice Management</p>
        <h1>Create account</h1>
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
