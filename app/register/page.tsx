import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark">IM</span><span>Invoice Management</span></div>
    <h1>Let&apos;s get you started</h1><p className="muted">Create a private workspace for your business. Add your company and create your first invoice.</p>
    <AuthForm mode="register" />
    <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
  </section></main>;
}
