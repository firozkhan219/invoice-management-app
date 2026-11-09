import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { getQuickPackingData } from "@/lib/packing-lists/packing-list-service";
import { hasPermission } from "@/lib/permissions/roles";
import { QuickPackingForm, type PackingInvoice } from "./quick-packing-form";

const num = (value: { toString(): string } | null | undefined) => (value ? Number(value.toString()) : 0);

export default async function NewPackingListPage({ searchParams }: { searchParams?: Promise<{ invoiceId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  if (!hasPermission(context.role, "invoices:create")) {
    redirect("/packing-lists?error=" + encodeURIComponent("Your role cannot create packing lists."));
  }

  const params = await searchParams;
  const data = await getQuickPackingData(context);
  const invoices: PackingInvoice[] = data.invoices.map((invoice) => ({
    id: invoice.id,
    label: `${invoice.invoiceNumber || "Invoice"} - ${invoice.buyer?.displayName || "Buyer"}`,
    companyId: invoice.companyId || "",
    buyerId: invoice.buyerId || "",
    exportReference: invoice.exporterReference || "",
    portOfLoading: invoice.portOfLoading || "",
    portOfDischarge: invoice.portOfDischarge || "",
    finalDestination: invoice.finalDestination || "",
    lines: invoice.items.map((line) => ({
      invoiceItemId: line.id,
      itemId: line.itemId || "",
      description: line.description,
      sku: line.sku || "",
      hsn: line.hsnSac || "",
      unit: line.unitCode || "",
      quantity: num(line.quantity),
      unitWeight: num(line.item?.weightKg)
    }))
  }));
  const preselected = invoices.some((invoice) => invoice.id === params?.invoiceId) ? params?.invoiceId ?? "" : "";

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Packing Lists</p>
          <h1>New packing list</h1>
          <p className="muted">Copy products from an invoice (or pick them yourself), fill in the boxes and weights, save.</p>
        </div>
      </header>
      {data.companies.length === 0 ? (
        <p className="notice error">Add your company details under My Company before creating a packing list.</p>
      ) : null}
      <QuickPackingForm
        invoices={invoices}
        products={data.items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku || "",
          hsn: item.hsnSac || "",
          unit: item.unit?.code || "",
          unitWeight: num(item.weightKg)
        }))}
        buyers={data.buyers.map((buyer) => ({ id: buyer.id, label: buyer.displayName }))}
        companies={data.companies.map((company) => ({ id: company.id, label: company.tradingName || company.legalName }))}
        defaults={{
          companyId: data.companies.find((company) => company.isDefault)?.id || data.companies[0]?.id || "",
          date: todayIso(),
          invoiceId: preselected
        }}
        canIssue={hasPermission(context.role, "invoices:issue")}
      />
    </AppShell>
  );
}
