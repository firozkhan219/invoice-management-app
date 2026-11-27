import { currentSessionTokenHash } from "@/lib/auth/session";
import { handleTenantForm, withFlash } from "@/lib/http/form";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateRecoveryCodes,
  stashRecoveryCodes
} from "@/lib/auth/two-factor-service";

/** Two-factor settings for the signed-in user: start setup, confirm, turn off, new recovery codes. */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/account#two-factor",
    handler: async ({ context, fields }) => {
      const value = (name: string) => (typeof fields[name] === "string" ? String(fields[name]) : "");
      switch (value("action")) {
        case "start":
          await beginTwoFactorSetup(context.userId, value("password"));
          return withFlash("/account#two-factor", "notice", "Add the setup key to your authenticator app, then enter the 6-digit code it shows.");
        case "confirm": {
          const codes = await confirmTwoFactorSetup(context.userId, value("code"), await currentSessionTokenHash());
          await stashRecoveryCodes(codes);
          return withFlash("/account#two-factor", "notice", "Two-factor authentication is on and other devices were signed out. Save your recovery codes now.");
        }
        case "disable":
          await disableTwoFactor(context.userId, value("password"), value("code"));
          return withFlash("/account#two-factor", "notice", "Two-factor authentication is off.");
        case "regenerate": {
          const codes = await regenerateRecoveryCodes(context.userId, value("password"), value("code"));
          await stashRecoveryCodes(codes);
          return withFlash("/account#two-factor", "notice", "New recovery codes issued. The old ones no longer work.");
        }
        default:
          throw new Error("Unknown action.");
      }
    }
  });
}
