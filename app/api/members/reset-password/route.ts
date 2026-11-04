import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { resetMemberPassword } from "@/lib/organisations/member-service";
import { resetMemberPasswordSchema } from "@/lib/validation/members";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/members",
    handler: async ({ context, fields }) => {
      await resetMemberPassword(context, parseForm(resetMemberPasswordSchema, fields));
      return withFlash("/members", "notice", "Password reset. The member has been signed out everywhere.");
    }
  });
}
