import crypto from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30-second steps) — the codes shown by
 * Google Authenticator, Microsoft Authenticator, Authy and similar apps. No external dependency.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A new random 160-bit secret, base32-encoded (the "setup key" typed into an authenticator app). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function currentTotpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS);
}

/** The 6-digit code for one time step (HOTP, RFC 4226). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a code against the current step and one step either side (allows ~30s clock drift).
 * Returns the matched step, or null. Steps at or before `lastUsedStep` are rejected (no replay).
 */
export function verifyTotp(secret: string, code: string, options: { now?: number; lastUsedStep?: number | null } = {}): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentTotpStep(options.now);
  for (const candidate of [step - 1, step, step + 1]) {
    if (options.lastUsedStep !== null && options.lastUsedStep !== undefined && candidate <= options.lastUsedStep) continue;
    const expected = Buffer.from(totpCode(secret, candidate));
    const given = Buffer.from(clean);
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return candidate;
  }
  return null;
}

/** otpauth:// link an authenticator app understands (tapping it on a phone adds the account). */
export function totpUri(secret: string, accountName: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten one-time recovery codes like "7K4Q-M2XD", for when the phone is lost. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(8);
    const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase().replace(/[\s-]/g, "")).digest("hex");
}

/** Groups a setup key in fours so it is easier to type: "JBSW Y3DP EHPK 3PXP". */
export function formatSetupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
