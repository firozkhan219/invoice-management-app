/** Today's date (YYYY-MM-DD) in the business time zone, for form defaults. */
export function todayIso(timeZone = process.env.APP_TIME_ZONE || "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
