import { registerUser, RegistrationClosedError } from "@/lib/auth/auth-service";
import { seeOther } from "@/lib/http/form";
import { registerSchema } from "@/lib/validation/auth";

// Called by the client-side AuthForm: JSON errors, redirect on success.
export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof RegistrationClosedError) {
      return Response.json({ ok: false, error: error.message }, { status: 403 });
    }
    const duplicate = error instanceof Error && error.message === "An account already exists for this email.";
    if (!duplicate) console.error(error);
    return Response.json(
      { ok: false, error: duplicate ? "An account already exists for this email. Please sign in." : "Registration is temporarily unavailable. Please try again shortly." },
      { status: duplicate ? 409 : 503 }
    );
  }

  return seeOther("/dashboard");
}
