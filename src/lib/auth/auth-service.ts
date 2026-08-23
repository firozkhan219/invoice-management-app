import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { slugifyOrganisationName } from "@/lib/organisations/slug";

export async function registerUser(input: RegisterInput) {
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

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error("Invalid email or password.");
  }

  await createSession(user.id);
  return user;
}
