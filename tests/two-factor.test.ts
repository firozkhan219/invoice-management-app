import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSetupKey,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpCode,
  totpUri,
  verifyTotp
} from "@/lib/security/totp";
import { hasPermission } from "@/lib/permissions/roles";

// RFC 6238 appendix B uses the ASCII secret "12345678901234567890" (SHA-1); these are the last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("TOTP", () => {
  it("round-trips base32", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
    expect(base32Decode("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq").toString("ascii")).toBe("12345678901234567890");
  });

  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("accepts the current code and one step of clock drift, rejects others", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 3), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", { now })).toBeNull();
  });

  it("refuses a code that was already used (replay)", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step - 1 })).toBe(step);
  });

  it("makes 32-character secrets, readable setup keys and an otpauth link", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(formatSetupKey("ABCDEFGHIJKL")).toBe("ABCD EFGH IJKL");
    const uri = totpUri(secret, "owner@example.test", "Invoice Management");
    expect(uri.startsWith("otpauth://totp/Invoice%20Management%3Aowner%40example.test?")).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
  });
});

describe("recovery codes", () => {
  it("issues ten distinct codes and hashes them ignoring case and dashes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(hashRecoveryCode(codes[0].toLowerCase().replace("-", ""))).toBe(hashRecoveryCode(codes[0]));
  });
});

describe("owner-only data controls", () => {
  it("only the owner may purge or reset", () => {
    expect(hasPermission("owner", "data:purge")).toBe(true);
    expect(hasPermission("admin", "data:purge")).toBe(false);
    expect(hasPermission("accountant", "data:purge")).toBe(false);
    expect(hasPermission("viewer", "data:purge")).toBe(false);
  });
});
