import { handleTenantForm, parseForm, withFlash } from "@/lib/http/form";
import { addMember } from "@/lib/organisations/member-service";
import { addMemberSchema } from "@/lib/validation/members";

export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/members",
    handler: async ({ context, fields }) => {
      await addMember(context, parseForm(addMemberSchema, fields));
      return withFlash("/members", "notice", "Member added.");
    }
  });
}
