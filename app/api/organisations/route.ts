import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { slugifyOrganisationName } from "@/lib/organisations/slug";
import { createOrganisationSchema } from "@/lib/validation/organisations";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = createOrganisationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const organisation = await prisma.$transaction(async (tx) => {
    const created = await tx.organisation.create({
      data: {
        name: parsed.data.name,
        slug: await slugifyOrganisationName(parsed.data.name, async (slug) => {
          const found = await tx.organisation.findUnique({ where: { slug } });
          return Boolean(found);
        }),
        members: {
          create: {
            userId: user.id,
            role: "owner"
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        organisationId: created.id,
        actorUserId: user.id,
        action: "organisation.create",
        entityType: "organisation",
        entityId: created.id
      }
    });

    return created;
  });

  return Response.json({ ok: true, organisation });
}
