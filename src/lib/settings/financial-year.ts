export function financialYearLabel(date: Date, startMonth: number): string {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= startMonth ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function calendarYearLabel(date: Date): string {
  return String(date.getUTCFullYear());
}

export function isDateInLockedPeriod(
  date: Date,
  periods: Array<{ startsOn: Date; endsOn: Date; isActive: boolean }>
): boolean {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  return periods.some((period) => {
    if (!period.isActive) return false;

    const startsOn = Date.UTC(
      period.startsOn.getUTCFullYear(),
      period.startsOn.getUTCMonth(),
      period.startsOn.getUTCDate()
    );
    const endsOn = Date.UTC(
      period.endsOn.getUTCFullYear(),
      period.endsOn.getUTCMonth(),
      period.endsOn.getUTCDate()
    );

    return day >= startsOn && day <= endsOn;
  });
}
