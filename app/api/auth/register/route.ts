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
    const message = error instanceof Error ? error.message : "Registration failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }

  redirect("/dashboard");
}
