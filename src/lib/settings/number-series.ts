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

export function resetKeyForRule(
  rule: "never" | "calendar_year" | "financial_year",
  date: Date,
  financialYearStartMonth: number
): string | null {
  if (rule === "never") return null;
  if (rule === "calendar_year") return calendarYearLabel(date);
  return financialYearLabel(date, financialYearStartMonth);
}
