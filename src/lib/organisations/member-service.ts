import type { MemberRole, MemberStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import type {
  AddMemberInput,
  ChangeOwnPasswordInput,
  ResetMemberPasswordInput,
  UpdateMemberInput
} from "@/lib/validation/members";

export async function listMembers(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "members:read");

  return prisma.organisationMember.findMany({
    where: { organisationId: tenant.organisationId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });
}

function assertCanAssignRole(actorRole: MemberRole, role: MemberRole) {
  if (role === "owner" && actorRole !== "owner") throw new Error("Only an owner can grant the owner role.");
}

/**
 * Adds a person to the organisation. Existing accounts are linked by email; new accounts
 * are created with the initial password typed by the admin (there is no email sending yet),
 * which the person should change from their account settings after signing in.
 */
export async function addMember(context: TenantContext, input: AddMemberInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "members:manage");
  assertCanAssignRole(tenant.role, input.role);

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: input.email } });

    if (!user) {
      if (!input.initialPassword) throw new Error("This email has no account yet. Enter an initial password for it.");
      user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.initialPassword) }
      });
    }

    const existing = await tx.organisationMember.findUnique({
      where: { organisationId_userId: { organisationId: tenant.organisationId, userId: user.id } }
    });
    if (existing && existing.status === "active") throw new Error("This person is already a member.");

    const member = existing
      ? await tx.organisationMember.update({ where: { id: existing.id }, data: { role: input.role, status: "active" } })
      : await tx.organisationMember.create({
          data: { organisationId: tenant.organisationId, userId: user.id, role: input.role }
        });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "member.add",
        entityType: "organisation_member",
        entityId: member.id,
        metadata: { email: input.email, role: input.role }
      }
    });

    return member;
  });
}

export async function updateMember(context: TenantContext, input: UpdateMemberInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "members:manage");

  return prisma.$transaction(async (tx) => {
    const member = await tx.organisationMember.findFirst({
      where: { id: input.memberId, organisationId: tenant.organisationId }
    });
    if (!member) throw new Error("Member not found.");
    if (member.userId === tenant.userId) throw new Error("You cannot change your own role or status.");
    if (member.role === "owner" && tenant.role !== "owner") throw new Error("Only an owner can change another owner.");
    assertCanAssignRole(tenant.role, input.role);

    const losesOwner = member.role === "owner" && member.status === "active" && (input.role !== "owner" || input.status !== "active");
    if (losesOwner) {
      const otherOwners = await tx.organisationMember.count({
        where: { organisationId: tenant.organisationId, role: "owner", status: "active", NOT: { id: member.id } }
      });
      if (otherOwners === 0) throw new Error("The organisation must keep at least one active owner.");
    }

    const updated = await tx.organisationMember.update({
      where: { id: member.id },
      data: { role: input.role, status: input.status as MemberStatus }
    });

    await tx.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "member.update",
        entityType: "organisation_member",
        entityId: member.id,
        metadata: { role: input.role, status: input.status }
      }
    });

    return updated;
  });
}

export async function resetMemberPassword(context: TenantContext, input: ResetMemberPasswordInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "members:manage");

  const member = await prisma.organisationMember.findFirst({
    where: { id: input.memberId, organisationId: tenant.organisationId }
  });
  if (!member) throw new Error("Member not found.");
  if (member.role === "owner" && tenant.role !== "owner") throw new Error("Only an owner can reset an owner's password.");
  if (member.userId === tenant.userId) throw new Error("Use your account settings to change your own password.");

  // The account may belong to other organisations too; only allow resets for people who are
  // members of no other organisation, so one org admin cannot take over accounts used elsewhere.
  const otherOrgs = await prisma.organisationMember.count({
    where: { userId: member.userId, NOT: { organisationId: tenant.organisationId } }
  });
  if (otherOrgs > 0) throw new Error("This account belongs to another organisation too; the person must change it themselves.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: member.userId }, data: { passwordHash: await hashPassword(input.newPassword) } }),
    prisma.session.deleteMany({ where: { userId: member.userId } }),
    prisma.auditLog.create({
      data: {
        organisationId: tenant.organisationId,
        actorUserId: tenant.userId,
        action: "member.password_reset",
        entityType: "organisation_member",
        entityId: member.id
      }
    })
  ]);
}

export async function changeOwnPassword(userId: string, currentSessionTokenHash: string | null, input: ChangeOwnPasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new Error("Current password is incorrect.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } }),
    // Sign out other devices, keep this session.
    prisma.session.deleteMany({
      where: { userId, ...(currentSessionTokenHash ? { NOT: { tokenHash: currentSessionTokenHash } } : {}) }
    })
  ]);
}
