import Link from "next/link";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth-form";
import { isRegistrationOpen } from "@/lib/auth/auth-service";

export default async function RegisterPage() {
  await connection();
  if (!(await isRegistrationOpen())) {
    return <main className="auth-page"><section className="auth-card">
      <div className="auth-brand"><span className="brand-mark">IM</span><span>Invoice Management</span></div>
      <h1>Registration is closed</h1><p className="muted">Ask an owner or admin of your organisation to add you from Users &amp; Roles.</p>
      <p className="auth-switch"><Link href="/login">Sign in</Link></p>
    </section></main>;
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark">IM</span><span>Invoice Management</span></div>
    <h1>Let&apos;s get you started</h1><p className="muted">Create a private workspace for your business. Add your company and create your first invoice.</p>
    <AuthForm mode="register" />
    <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
  </section></main>;
}
