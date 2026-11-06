import { loginUser } from "@/lib/auth/auth-service";
import { seeOther } from "@/lib/http/form";
import { loginSchema } from "@/lib/validation/auth";

// Called by the client-side AuthForm: JSON errors, redirect on success.
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await loginUser(parsed.data);
  } catch (error) {
    const invalid = error instanceof Error && error.message === "Invalid email or password.";
    if (!invalid) console.error(error);
    return Response.json(
      { ok: false, error: invalid ? "Invalid email or password." : "Sign in is temporarily unavailable. Please try again shortly." },
      { status: invalid ? 401 : 503 }
    );
  }

  return seeOther("/dashboard");
}
