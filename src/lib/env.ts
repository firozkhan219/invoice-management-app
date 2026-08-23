import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  BANK_FIELD_ENCRYPTION_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export const env = envSchema.parse(process.env);
