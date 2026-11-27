"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // After a correct password on an account with two-factor on, the form asks for the code.
  const [needsCode, setNeedsCode] = useState(false);
  const register = mode === "register";

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const endpoint = needsCode ? "/api/auth/2fa" : `/api/auth/${mode}`;
      const response = await fetch(endpoint, { method: "POST", body: new FormData(event.currentTarget) });
      if (response.redirected && response.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      const result = await response.json();
      if (result.ok && result.twoFactor) {
        setNeedsCode(true);
        return;
      }
      const validationErrors = result.errors ? Object.values(result.errors).flat().join(" ") : "";
      const message = result.error || validationErrors || "Unable to continue. Please try again.";
      if (needsCode && /expired/i.test(message)) setNeedsCode(false);
      setError(message);
    } catch {
      setError("We could not connect. Check your internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (needsCode) {
    return <form className="form" onSubmit={submit} key="code">
      <p className="muted">Open your authenticator app and enter the 6-digit code for this account. Lost your phone? Enter one of your recovery codes instead.</p>
      <div className="field">
        <label htmlFor="code">Two-factor code</label>
        <input id="code" name="code" required autoFocus inputMode="text" autoComplete="one-time-code" maxLength={20} placeholder="123 456" />
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</button>
      <button className="button subtle" type="button" onClick={() => { setNeedsCode(false); setError(""); }}>Back</button>
    </form>;
  }

  return <form className="form" onSubmit={submit} key="password">
    {register && <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required maxLength={160} autoComplete="name" /></div>}
    <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required maxLength={320} autoComplete="email" placeholder="you@company.com" /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={register ? 10 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} />{register && <small className="muted">Use at least 10 characters.</small>}</div>
    {register && <div className="field"><label htmlFor="organisationName">Business name</label><input id="organisationName" name="organisationName" required minLength={2} maxLength={180} autoComplete="organization" /></div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Please wait…" : register ? "Create your workspace" : "Sign in"}</button>
  </form>;
}
