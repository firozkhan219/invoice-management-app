import { cookies } from "next/headers";
import { destroySession } from "@/lib/auth/session";
import { seeOther } from "@/lib/http/form";
import { ACTIVE_ORG_COOKIE } from "@/lib/organisations/membership";

export async function POST() {
  await destroySession();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  return seeOther("/login");
}
