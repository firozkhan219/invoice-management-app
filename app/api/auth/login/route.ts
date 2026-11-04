import { loginUser } from "@/lib/auth/auth-service";
import { seeOther, userFacingMessage, withFlash, zodMessage } from "@/lib/http/form";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return seeOther(withFlash("/login", "error", zodMessage(parsed.error)));

  try {
    await loginUser(parsed.data);
  } catch (error) {
    return seeOther(withFlash("/login", "error", userFacingMessage(error, "Sign in failed.")));
  }

  return seeOther("/dashboard");
}
