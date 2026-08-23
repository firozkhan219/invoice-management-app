import { listInvoices, type InvoiceListFilters } from "@/lib/invoices/invoice-service";
import type { TenantContext } from "@/lib/repositories/tenant-context";

export async function invoiceRegisterCsv(context: TenantContext, filters: InvoiceListFilters = {}) {
  const invoices = await listInvoices(context, filters);
  const headers = [
    "Invoice Date",
    "Invoice Number",
    "Company",
    "Buyer",
    "Status",
    "Currency",
    "Subtotal",
    "IGST",
    "CGST",
    "SGST",
    "Grand Total",
    "Paid Total",
    "Balance Due"
  ];

  const rows = invoices.map((invoice) => [
    invoice.invoiceDate.toISOString().slice(0, 10),
    invoice.invoiceNumber || "",
    invoice.company?.legalName || "",
    invoice.buyer?.displayName || "",
    invoice.status,
    invoice.currency,
    invoice.subtotal.toString(),
    invoice.igstTotal.toString(),
    invoice.cgstTotal.toString(),
    invoice.sgstTotal.toString(),
    invoice.grandTotal.toString(),
    invoice.paidTotal.toString(),
    invoice.balanceDue.toString()
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, "\"\"")}"`;
}
