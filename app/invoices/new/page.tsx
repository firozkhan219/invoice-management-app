import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoiceEditorData } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";
import { todayIso } from "@/lib/dates";
import { QuickInvoiceForm } from "./quick-invoice-form";

export default async function NewInvoicePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  if (!hasPermission(context.role, "invoices:create")) {
    redirect("/invoices?error=" + encodeURIComponent("Your role cannot create invoices."));
  }
  const editor = await getInvoiceEditorData(context);
  const defaultCompanyId = editor.settings?.defaultCompanyId || editor.companies.find((company) => company.isDefault)?.id || editor.companies[0]?.id || "";

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Invoices</p>
          <h1>New invoice</h1>
          <p className="muted">Pick the buyer, add products, save. Export and shipping fields can be added later on the invoice page.</p>
        </div>
      </header>
      {editor.companies.length === 0 ? (
        <p className="notice error">Add your company details under My Company before creating an invoice.</p>
      ) : null}
      <QuickInvoiceForm
        products={editor.masterItems.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          rate: item.saleRate ? item.saleRate.toString() : "",
          gst: item.taxRate ? item.taxRate.rate.toString() : "",
          hsn: item.hsnSac,
          unit: item.unit?.code ?? null
        }))}
        buyers={editor.buyers.map((buyer) => ({ id: buyer.id, label: buyer.displayName }))}
        companies={editor.companies.map((company) => ({ id: company.id, label: company.tradingName || company.legalName }))}
        bankAccounts={editor.bankAccounts.map((account) => ({ id: account.id, label: `${account.bankName} - ${account.accountNumberLast4}` }))}
        defaults={{
          companyId: defaultCompanyId,
          bankAccountId: editor.settings?.defaultBankAccountId || editor.bankAccounts.find((account) => account.isDefault)?.id || "",
          invoiceDate: todayIso(),
          taxMode: editor.settings?.defaultTaxMode || "automatic",
          notes: editor.settings?.defaultNotes || ""
        }}
        canIssue={hasPermission(context.role, "invoices:issue") && editor.series.length > 0}
      />
    </AppShell>
  );
}
