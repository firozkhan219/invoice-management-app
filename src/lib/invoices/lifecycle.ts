type ComparableAmount = number | { gt(value: number): boolean };

export type InvoiceLifecycleInput = {
  status: string;
  companyId?: string | null;
  buyerId?: string | null;
  itemCount: number;
  grandTotal: ComparableAmount;
};

export function canDeleteDraftInvoiceStatus(status: string): boolean {
  return status === "draft";
}

export function draftIssueRequirements(invoice: InvoiceLifecycleInput): string[] {
  if (invoice.status !== "draft") return ["invoice must be a draft"];

  return [
    !invoice.companyId ? "select a company" : null,
    !invoice.buyerId ? "select a buyer" : null,
    invoice.itemCount === 0 ? "add at least one line item" : null,
    !isPositive(invoice.grandTotal) ? "make the invoice total greater than zero" : null
  ].filter((requirement): requirement is string => Boolean(requirement));
}

export function draftLifecycleLabel(invoice: InvoiceLifecycleInput) {
  if (invoice.status !== "draft") return "Locked";
  if (!invoice.companyId || !invoice.buyerId) return "Needs company/buyer";
  if (invoice.itemCount === 0) return "Needs line item";
  if (!isPositive(invoice.grandTotal)) return "Needs positive total";
  return "Ready to issue";
}

function isPositive(amount: ComparableAmount): boolean {
  if (typeof amount === "number") return amount > 0;
  return amount.gt(0);
}
