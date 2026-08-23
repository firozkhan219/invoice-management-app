import crypto from "node:crypto";

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function getKey(): Buffer {
  const raw = process.env.BANK_FIELD_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("BANK_FIELD_ENCRYPTION_KEY is required to store bank account numbers.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("BANK_FIELD_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function encryptSensitiveText(plaintext: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptSensitiveText(value: EncryptedValue): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
