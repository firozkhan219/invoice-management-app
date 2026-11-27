import { completeLoginChallenge } from "@/lib/auth/two-factor-service";
import { seeOther } from "@/lib/http/form";

/** Second sign-in step: the authenticator (or recovery) code. JSON errors for the client form. */
export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "").trim();
  if (!code) return Response.json({ ok: false, error: "Enter the code from your authenticator app." }, { status: 400 });

  try {
    await completeLoginChallenge(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed.";
    return Response.json({ ok: false, error: message }, { status: 401 });
  }
  return seeOther("/dashboard");
}
