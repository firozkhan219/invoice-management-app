import { redirect } from "next/navigation";
import { registerUser } from "@/lib/auth/auth-service";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await registerUser(parsed.data);
  } catch (error) {
    const duplicate = error instanceof Error && error.message === "An account already exists for this email.";
    return Response.json({ ok: false, error: duplicate ? "An account already exists for this email. Please sign in." : "Registration is temporarily unavailable. Please try again shortly." }, { status: duplicate ? 409 : 503 });
  }

  redirect("/dashboard");
}
