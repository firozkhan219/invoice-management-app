import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { createOpaqueToken, hashToken } from "@/lib/security/tokens";

export const SESSION_COOKIE_NAME = "invoice_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string): Promise<string> {
  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const requestHeaders = await headers();

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: requestHeaders.get("user-agent"),
      ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) }
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: "active" },
            include: { organisation: true },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return session.user;
}
