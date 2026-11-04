import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import type { TenantContext } from "@/lib/repositories/tenant-context";

export type FormFields = Record<string, FormDataEntryValue>;

/** Error whose message is safe and meant to be shown to the user. */
export class FormError extends Error {}

/** 303 redirect so a POSTed form lands on a GET page. Relative Location works behind proxies. */
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

export function withFlash(path: string, kind: "error" | "notice", message: string): string {
  const [base, hash] = path.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${kind}=${encodeURIComponent(message.slice(0, 500))}${hash ? `#${hash}` : ""}`;
}

export function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the form and try again.";
  const field = issue.path.map(String).join(".");
  if (!field) return issue.message;
  const label = field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]/g, " ").toLowerCase();
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${issue.message}`;
}

export function parseForm<T extends z.ZodType>(schema: T, fields: FormFields): z.infer<T> {
  const parsed = schema.safeParse(fields);
  if (!parsed.success) throw new FormError(zodMessage(parsed.error));
  return parsed.data;
}

export function userFacingMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "A record with the same unique value already exists.";
    if (error.code === "P2034") return "Another change happened at the same time. Please try again.";
    if (error.code === "P2025") return "The record was not found or was changed elsewhere.";
    console.error(error);
    return fallback;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error(error);
    return "Some submitted values were not valid.";
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/** Keys that were submitted as empty strings, so the matching nullable columns can be cleared. */
export function blankKeys(fields: FormFields, allowed: readonly string[]): string[] {
  return allowed.filter((key) => key in fields && typeof fields[key] === "string" && String(fields[key]).trim() === "");
}

type TenantFormArgs = {
  context: TenantContext;
  fields: FormFields;
  formData: FormData;
};

type TenantFormOptions = {
  /** Where to send the user if the action fails. May depend on submitted fields. */
  errorPath: string | ((fields: FormFields) => string);
  /** Runs the action; returns the success destination. */
  handler: (args: TenantFormArgs) => Promise<string>;
};

/**
 * Shared wrapper for HTML form POST routes: authenticates, resolves the tenant,
 * runs the handler, and always answers with a redirect (never raw JSON or a 500 page).
 */
export async function handleTenantForm(request: Request, options: TenantFormOptions): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return seeOther(withFlash("/login", "error", "Please sign in to continue."));

  const context = await getTenantContextForUser(user.id);
  if (!context) return seeOther(withFlash("/login", "error", "Your account has no active organisation."));

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return seeOther(withFlash("/dashboard", "error", "The form could not be read."));
  }
  const fields = Object.fromEntries(formData) as FormFields;
  const errorPath = typeof options.errorPath === "function" ? options.errorPath(fields) : options.errorPath;

  try {
    const destination = await options.handler({ context, fields, formData });
    return seeOther(destination);
  } catch (error) {
    return seeOther(withFlash(safeLocalPath(errorPath), "error", userFacingMessage(error)));
  }
}

/** Only allow same-site relative paths in redirects built from form data. */
export function safeLocalPath(path: string, fallback = "/dashboard"): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}

export function idPath(prefix: string, id: FormDataEntryValue | undefined, fallback: string): string {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? `${prefix}/${id}` : fallback;
}
