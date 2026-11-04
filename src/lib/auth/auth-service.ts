import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { slugifyOrganisationName } from "@/lib/organisations/slug";

/**
 * Public sign-up is closed unless ALLOW_REGISTRATION=true, except for the very first
 * account on a fresh install (which becomes the owner). Others are added from Users & Roles.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === "true") return true;
  return (await prisma.user.count()) === 0;
}

export async function registerUser(input: RegisterInput) {
  if (!(await isRegistrationOpen())) {
    throw new Error("Registration is closed. Ask an owner or admin to add you from Users & Roles.");
  }
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email } });

    if (existing) {
      throw new Error("An account already exists for this email.");
    }

    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash
      }
    });

    const organisation = await tx.organisation.create({
      data: {
        name: input.organisationName,
        slug: await slugifyOrganisationName(input.organisationName, async (slug) => {
          const found = await tx.organisation.findUnique({ where: { slug } });
          return Boolean(found);
        })
      }
    });

    await tx.organisationMember.create({
      data: {
        organisationId: organisation.id,
        userId: user.id,
        role: "owner"
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: organisation.id,
        actorUserId: user.id,
        action: "auth.register",
        entityType: "organisation",
        entityId: organisation.id
      }
    });

    return { user, organisation };
  });

  await createSession(result.user.id);
  return result;
}

// Valid bcrypt hash of a random string, compared when the email is unknown so response
// time does not reveal which emails have accounts.
const DUMMY_PASSWORD_HASH = "$2b$12$NdJJRvOg4juMV39E4ItmWO7UDru0d5eFtWU3HCwhjGKCChzveOFzu";

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordOk) {
    throw new Error("Invalid email or password.");
  }

  await createSession(user.id);
  return user;
}
