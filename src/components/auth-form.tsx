"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const register = mode === "register";

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", body: new FormData(event.currentTarget) });
      if (response.redirected && response.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      const result = await response.json();
      const validationErrors = result.errors ? Object.values(result.errors).flat().join(" ") : "";
      setError(result.error || validationErrors || "Unable to continue. Please try again.");
    } catch {
      setError("We could not connect. Check your internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return <form className="form" onSubmit={submit}>
    {register && <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required maxLength={160} autoComplete="name" /></div>}
    <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={320} autoComplete="email" placeholder="you@company.com" /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={register ? 10 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} />{register && <small className="muted">Use at least 10 characters.</small>}</div>
    {register && <div className="field"><label htmlFor="organisationName">Business name</label><input id="organisationName" name="organisationName" required minLength={2} maxLength={180} autoComplete="organization" /></div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Please wait…" : register ? "Create your workspace" : "Sign in"}</button>
  </form>;
}
