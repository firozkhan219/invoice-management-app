import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const domain = process.argv[2];
if (!domain || domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
  console.error("Usage: node scripts/configure-online.mjs invoices.your-domain.com");
  process.exit(1);
}
const hex = () => randomBytes(32).toString("hex");
try {
  await writeFile(".env.online", [
    `APP_DOMAIN=${domain.toLowerCase()}`,
    `DB_PASSWORD=${hex()}`,
    `DB_ROOT_PASSWORD=${hex()}`,
    `AUTH_SECRET=${hex()}`,
    `BANK_FIELD_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
    ""
  ].join("\n"), { flag: "wx", mode: 0o600 });
  console.log("Created private .env.online. Keep a secure backup of this file alongside database and upload backups.");
} catch (error) {
  if (error.code === "EEXIST") {
    console.error(".env.online already exists. Existing passwords and encryption keys were preserved.");
    process.exit(1);
  }
  throw error;
}
