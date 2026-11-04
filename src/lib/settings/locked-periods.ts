import type { Prisma } from "@prisma/client";
import { isDateInLockedPeriod } from "@/lib/settings/financial-year";

/** Throws if `date` falls inside an active locked period for the organisation. */
export async function assertDateNotLocked(
  tx: Prisma.TransactionClient,
  organisationId: string,
  date: Date,
  action: string
): Promise<void> {
  const periods = await tx.lockedPeriod.findMany({
    where: { organisationId, isActive: true, startsOn: { lte: date }, endsOn: { gte: startOfUtcDay(date) } },
    select: { startsOn: true, endsOn: true, isActive: true, name: true }
  });
  const locked = periods.find((period) => isDateInLockedPeriod(date, [period]));
  if (locked) {
    throw new Error(`Cannot ${action}: ${date.toISOString().slice(0, 10)} is inside the locked period "${locked.name}".`);
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
