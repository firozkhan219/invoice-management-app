export function normaliseAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/\s+/g, "");
}

export function accountLast4(accountNumber: string): string {
  const normalised = normaliseAccountNumber(accountNumber);
  return normalised.slice(-4).padStart(Math.min(4, normalised.length), "X");
}

export function maskAccountNumber(last4: string): string {
  return last4 ? `XXXX XXXX ${last4}` : "XXXX";
}
