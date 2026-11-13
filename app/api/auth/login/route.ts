import { redirect } from "next/navigation";
import { loginUser } from "@/lib/auth/auth-service";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await loginUser(parsed.data);
  } catch (error) {
    const invalid = error instanceof Error && error.message === "Invalid email or password.";
    return Response.json({ ok: false, error: invalid ? "Invalid email or password." : "Sign in is temporarily unavailable. Please try again shortly." }, { status: invalid ? 401 : 503 });
  }

  redirect("/dashboard");
}
