import { decryptSensitiveText } from "@/lib/security/encryption";

/**
 * Adds the decrypted full `accountNumber` to a bank record (live row or issued snapshot)
 * so documents sent to buyers show payable details. The ciphertext fields are removed.
 * Falls back to the masked last 4 digits if decryption is not possible.
 */
export function bankRecordForDocument(bank: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!bank) return null;
  const { accountNumberCiphertext, accountNumberIv, accountNumberTag, ...rest } = bank;

  if (typeof accountNumberCiphertext === "string" && typeof accountNumberIv === "string" && typeof accountNumberTag === "string") {
    try {
      return {
        ...rest,
        accountNumber: decryptSensitiveText({ ciphertext: accountNumberCiphertext, iv: accountNumberIv, tag: accountNumberTag })
      };
    } catch (error) {
      console.error("Could not decrypt bank account number for document", error);
    }
  }

  return rest;
}
