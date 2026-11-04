import { registerUser } from "@/lib/auth/auth-service";
import { seeOther, userFacingMessage, withFlash, zodMessage } from "@/lib/http/form";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return seeOther(withFlash("/register", "error", zodMessage(parsed.error)));

  try {
    await registerUser(parsed.data);
  } catch (error) {
    return seeOther(withFlash("/register", "error", userFacingMessage(error, "Registration failed.")));
  }

  return seeOther("/dashboard");
}
