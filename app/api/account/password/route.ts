import { currentSessionTokenHash } from "@/lib/auth/session";
import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { changeOwnPassword } from "@/lib/organisations/member-service";
import { changeOwnPasswordSchema } from "@/lib/validation/members";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/account",
    handler: async ({ context, fields }) => {
      await changeOwnPassword(context.userId, await currentSessionTokenHash(), parseForm(changeOwnPasswordSchema, fields));
      return withFlash("/account", "notice", "Password changed. Other devices were signed out.");
    }
  });
}
