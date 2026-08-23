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
    const message = error instanceof Error ? error.message : "Login failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }

  redirect("/dashboard");
}
