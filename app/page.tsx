import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="muted">Business invoicing</p>
        <h1>Invoice Management</h1>
        <p className="muted">
          Sign in or create your organisation to manage invoices, buyers, payments, and reports.
        </p>
        <div className="grid">
          <Link className="button" href="/register">
            Create account
          </Link>
          <Link href="/login">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
