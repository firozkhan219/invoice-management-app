import { calendarYearLabel, financialYearLabel } from "@/lib/settings/financial-year";

export type SeriesPatternInput = {
  pattern: string;
  prefix?: string | null;
  sequence: number;
  date: Date;
  financialYearStartMonth: number;
};

export function formatSequence(sequence: number, padding: number): string {
  return String(sequence).padStart(Math.max(1, padding), "0");
}

export function renderInvoiceNumber(input: SeriesPatternInput): string {
  const fy = financialYearLabel(input.date, input.financialYearStartMonth);
  const yyyy = calendarYearLabel(input.date);
  const yy = yyyy.slice(-2);

  return input.pattern
    .replaceAll("{PREFIX}", input.prefix ?? "")
    .replaceAll("{FY}", fy)
    .replaceAll("{YYYY}", yyyy)
    .replaceAll("{YY}", yy)
    .replace(/\{SEQ(?::(\d+))?\}/g, (_match, width: string | undefined) =>
      formatSequence(input.sequence, width ? Number(width) : 1)
    )
    .replace(/\{(#+)\}/g, (_match, hashes: string) => formatSequence(input.sequence, hashes.length))
    .replace(/#+/g, (match) => formatSequence(input.sequence, match.length));
}

/** UTC [start, end) range of the numbering period that contains `date`, or null for "never". */
export function periodRangeForRule(
  rule: "never" | "calendar_year" | "financial_year",
  date: Date,
  financialYearStartMonth: number
): { start: Date; end: Date } | null {
  if (rule === "never") return null;
  const year = date.getUTCFullYear();
  if (rule === "calendar_year") {
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  const startYear = date.getUTCMonth() + 1 >= financialYearStartMonth ? year : year - 1;
  return {
    start: new Date(Date.UTC(startYear, financialYearStartMonth - 1, 1)),
    end: new Date(Date.UTC(startYear + 1, financialYearStartMonth - 1, 1))
  };
}

export type SeriesState = {
  resetRule: "never" | "calendar_year" | "financial_year";
  startingNumber: number;
  nextSequence: number;
  lastResetKey: string | null;
};

/**
 * Chooses the sequence for a document dated `date`, based on the highest sequence already
 * used in that document's own period (so back-dated documents never restart a newer period),
 * and says how the series counters should be updated afterwards.
 */
export function planSequence(
  series: SeriesState,
  date: Date,
  financialYearStartMonth: number,
  maxUsedInPeriod: number | null
): { sequence: number; resetKey: string | null; advanceSeries: boolean } {
  const resetKey = resetKeyForRule(series.resetRule, date, financialYearStartMonth);
  const fromHistory = maxUsedInPeriod === null ? series.startingNumber : maxUsedInPeriod + 1;
  const isCurrentOrNewerPeriod = resetKey === null || series.lastResetKey === null || resetKey >= series.lastResetKey;
  const fromCounter = resetKey === null || series.lastResetKey === resetKey ? series.nextSequence : series.startingNumber;
  const sequence = Math.max(series.startingNumber, fromHistory, isCurrentOrNewerPeriod ? fromCounter : 0);

  return { sequence, resetKey, advanceSeries: isCurrentOrNewerPeriod };
}

export function resetKeyForRule(
  rule: "never" | "calendar_year" | "financial_year",
  date: Date,
  financialYearStartMonth: number
): string | null {
  if (rule === "never") return null;
  if (rule === "calendar_year") return calendarYearLabel(date);
  return financialYearLabel(date, financialYearStartMonth);
}
