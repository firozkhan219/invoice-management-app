import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { decryptSensitiveText, encryptSensitiveText, type EncryptedValue } from "@/lib/security/encryption";
import { verifyPassword } from "@/lib/security/passwords";
import { createOpaqueToken, hashToken } from "@/lib/security/tokens";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp
} from "@/lib/security/totp";

export const TWO_FACTOR_COOKIE = "invoice_2fa";
const CHALLENGE_PURPOSE = "login_2fa";
const CHALLENGE_MINUTES = 5;
const RECOVERY_CODES_COOKIE = "invoice_recovery_codes";

type TwoFactorUser = {
  id: string;
  email: string;
  passwordHash: string;
  totpSecret: Prisma.JsonValue | null;
  totpEnabledAt: Date | null;
  totpLastStep: number | null;
  totpRecoveryCodes: Prisma.JsonValue | null;
};

function readSecret(user: Pick<TwoFactorUser, "totpSecret">): string | null {
  const value = user.totpSecret as EncryptedValue | null;
  if (!value || typeof value !== "object" || !("ciphertext" in value)) return null;
  return decryptSensitiveText(value);
}

function recoveryHashes(user: Pick<TwoFactorUser, "totpRecoveryCodes">): string[] {
  return Array.isArray(user.totpRecoveryCodes) ? (user.totpRecoveryCodes as string[]) : [];
}

export function twoFactorEnabled(user: Pick<TwoFactorUser, "totpEnabledAt">): boolean {
  return Boolean(user.totpEnabledAt);
}

/** State for the account page: whether 2FA is on, and the setup key while a setup is in progress. */
export async function getTwoFactorStatus(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const enabled = twoFactorEnabled(user);
  return {
    enabled,
    enabledAt: user.totpEnabledAt,
    pendingSecret: !enabled ? readSecret(user) : null,
    recoveryCodesLeft: recoveryHashes(user).length,
    email: user.email
  };
}

/** Step 1: after re-entering the password, a fresh secret is stored (not active until a code is confirmed). */
export async function beginTwoFactorSetup(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (twoFactorEnabled(user)) throw new Error("Two-factor authentication is already on.");
  if (!(await verifyPassword(password, user.passwordHash))) throw new Error("Password is incorrect.");

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSensitiveText(secret) as unknown as Prisma.InputJsonValue, totpLastStep: null }
  });
  await audit(userId, "auth.2fa.setup_started");
  return secret;
}

/** Step 2: the first code from the app proves it is set up; 2FA turns on and recovery codes are issued. */
export async function confirmTwoFactorSetup(userId: string, code: string, keepSessionTokenHash: string | null = null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (twoFactorEnabled(user)) throw new Error("Two-factor authentication is already on.");
  const secret = readSecret(user);
  if (!secret) throw new Error("Start the setup again.");
  const step = verifyTotp(secret, code);
  if (step === null) throw new Error("That code is not right. Check the time on your phone and try the newest code.");

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: new Date(),
        totpLastStep: step,
        totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode)
      }
    }),
    // Sessions on other devices were opened without a code; sign them out.
    prisma.session.deleteMany({
      where: { userId, ...(keepSessionTokenHash ? { NOT: { tokenHash: keepSessionTokenHash } } : {}) }
    })
  ]);
  await audit(userId, "auth.2fa.enabled");
  return recoveryCodes;
}

export async function disableTwoFactor(userId: string, password: string, code: string) {
  await verifyStepUp(userId, password, code, { requireTwoFactor: true });
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: Prisma.DbNull, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: Prisma.DbNull }
  });
  await audit(userId, "auth.2fa.disabled");
}

export async function regenerateRecoveryCodes(userId: string, password: string, code: string) {
  await verifyStepUp(userId, password, code, { requireTwoFactor: true });
  const recoveryCodes = generateRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode) } });
  await audit(userId, "auth.2fa.recovery_regenerated");
  return recoveryCodes;
}

/**
 * Accepts a current authenticator code or an unused recovery code. A matched code is consumed
 * (the TOTP step is remembered, a recovery code is removed) so it cannot be used again.
 */
async function consumeSecondFactor(user: TwoFactorUser, code: string): Promise<boolean> {
  const secret = readSecret(user);
  if (!secret || !twoFactorEnabled(user)) return false;
  const clean = code.trim();

  const step = verifyTotp(secret, clean, { lastUsedStep: user.totpLastStep });
  if (step !== null) {
    // Conditional update: a concurrent request that already used this step wins, this one fails.
    const updated = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step }
    });
    return updated.count === 1;
  }

  const hash = hashRecoveryCode(clean);
  const hashes = recoveryHashes(user);
  if (clean.length >= 8 && hashes.includes(hash)) {
    await prisma.user.update({ where: { id: user.id }, data: { totpRecoveryCodes: hashes.filter((item) => item !== hash) } });
    await audit(user.id, "auth.2fa.recovery_code_used", { left: hashes.length - 1 });
    return true;
  }
  return false;
}

/**
 * Re-checks the signed-in person before a dangerous action: the account password, and the
 * authenticator code when 2FA is on. With requireTwoFactor, 2FA must be turned on first.
 */
export async function verifyStepUp(
  userId: string,
  password: string,
  code: string | undefined,
  options: { requireTwoFactor?: boolean } = {}
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password || "", user.passwordHash))) {
    await audit(userId, "auth.step_up.failed", { reason: "password" });
    throw new Error("Password is incorrect.");
  }
  if (!twoFactorEnabled(user)) {
    if (options.requireTwoFactor) {
      throw new Error("Turn on two-factor authentication under My account first. This action needs it.");
    }
    return;
  }
  if (!code || !(await consumeSecondFactor(user, code))) {
    await audit(userId, "auth.step_up.failed", { reason: "code" });
    throw new Error("The two-factor code is not right. Use the newest code from your authenticator app.");
  }
}

/* ---------- Sign-in second step ---------- */

/** Called after a correct password when 2FA is on: remembers who is signing in for five minutes. */
export async function startLoginChallenge(user: { email: string }) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60 * 1000);
  await prisma.verificationToken.create({
    data: { email: user.email, tokenHash: hashToken(token), purpose: CHALLENGE_PURPOSE, expiresAt }
  });
  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

/** Second step of sign-in: a correct code (or recovery code) creates the real session. */
export async function completeLoginChallenge(code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_COOKIE)?.value;
  if (!token) throw new Error("Your sign-in expired. Enter your email and password again.");

  const challenge = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!challenge || challenge.purpose !== CHALLENGE_PURPOSE || challenge.usedAt || challenge.expiresAt < new Date()) {
    cookieStore.delete(TWO_FACTOR_COOKIE);
    throw new Error("Your sign-in expired. Enter your email and password again.");
  }

  const user = await prisma.user.findUnique({ where: { email: challenge.email } });
  if (!user || !(await consumeSecondFactor(user, code))) {
    if (user) await audit(user.id, "auth.2fa.login_failed");
    throw new Error("That code is not right. Use the newest code from your authenticator app.");
  }

  await prisma.verificationToken.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
  cookieStore.delete(TWO_FACTOR_COOKIE);
  await createSession(user.id);
  await audit(user.id, "auth.login.2fa");
  return user;
}

/* ---------- Showing new recovery codes once ---------- */

/** Keeps freshly issued recovery codes in a short-lived encrypted cookie so the account page can show them once. */
export async function stashRecoveryCodes(codes: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_CODES_COOKIE, JSON.stringify(encryptSensitiveText(codes.join(","))), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/account",
    maxAge: 120
  });
}

export async function readStashedRecoveryCodes(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(RECOVERY_CODES_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decryptSensitiveText(JSON.parse(raw) as EncryptedValue).split(",");
  } catch {
    return null;
  }
}

async function audit(userId: string, action: string, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { actorUserId: userId, action, entityType: "user", entityId: userId, ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}) }
  });
}
