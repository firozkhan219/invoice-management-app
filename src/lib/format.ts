type Numeric = { toString(): string } | number | string | null | undefined;

/** Formats an amount Indian-style with two decimals, e.g. 276150 -> "2,76,150.00". */
export function formatAmount(value: Numeric): string {
  const number = Number(value?.toString() ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Formats an amount with its currency code, e.g. "INR 2,76,150.00". */
export function formatMoney(currency: string | null | undefined, value: Numeric): string {
  return `${currency || "INR"} ${formatAmount(value)}`;
}

/** Formats a quantity without trailing zeros, e.g. "120" or "1.25". */
export function formatQuantity(value: Numeric): string {
  const number = Number(value?.toString() ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });
}
