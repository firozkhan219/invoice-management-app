import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark">IM</span><span>Invoice Management</span></div>
    <h1>Welcome back</h1><p className="muted">Your invoices and packing lists, together in one workspace.</p>
    <AuthForm mode="login" />
    <p className="auth-switch">New here? <Link href="/register">Create your workspace</Link></p>
  </section></main>;
}
