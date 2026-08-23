import { describe, expect, it } from "vitest";
import { accountLast4, maskAccountNumber, normaliseAccountNumber } from "@/lib/companies/bank-account";
import { decryptSensitiveText, encryptSensitiveText } from "@/lib/security/encryption";

describe("bank account helpers", () => {
  it("normalises spacing and masks account numbers by last four digits", () => {
    expect(normaliseAccountNumber(" 1234 5678 9012 ")).toBe("123456789012");
    expect(accountLast4("1234 5678 9012")).toBe("9012");
    expect(maskAccountNumber("9012")).toBe("XXXX XXXX 9012");
  });

  it("encrypts account numbers without storing plaintext in ciphertext", () => {
    process.env.BANK_FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSensitiveText("123456789012");

    expect(encrypted.ciphertext).not.toContain("123456789012");
    expect(decryptSensitiveText(encrypted)).toBe("123456789012");
  });
});
