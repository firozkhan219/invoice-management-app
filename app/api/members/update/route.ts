import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { updateMember } from "@/lib/organisations/member-service";
import { updateMemberSchema } from "@/lib/validation/members";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/members",
    handler: async ({ context, fields }) => {
      await updateMember(context, parseForm(updateMemberSchema, fields));
      return withFlash("/members", "notice", "Member updated.");
    }
  });
}
