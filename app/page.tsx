import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">IM</span><span>Invoice Management</span></div>
        <h1>Less paperwork.<br />More business.</h1>
        <p className="muted">
          Create professional invoices and packing lists in one organised workspace. Save your buyers and products, track payments, and download ready-to-share PDFs.
        </p>
        <div className="grid">
          <Link className="button" href="/register">
            Create your workspace
          </Link>
          <Link href="/login">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
