import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="muted">Business invoicing</p>
        <h1>Invoice Management</h1>
        <p className="muted">
          Sign in to manage invoices, buyers, payments, and reports.
        </p>
        <div className="grid">
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
