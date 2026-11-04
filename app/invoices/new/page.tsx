import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoiceEditorData } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";
import { todayIso } from "@/lib/dates";
import { DraftFields } from "../draft-fields";

export default async function NewInvoicePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  if (!hasPermission(context.role, "invoices:create")) {
    redirect("/invoices?error=" + encodeURIComponent("Your role cannot create invoices."));
  }
  const editor = await getInvoiceEditorData(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Draft workflow</p>
          <h1>New invoice draft</h1>
        </div>
      </header>
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="muted">Invoice setup</p>
            <h2>Core details</h2>
          </div>
          <FilePlus2 size={20} />
        </div>
        <form className="form" action="/api/invoices" method="post">
          <DraftFields
            editor={editor}
            values={{
              companyId: editor.settings?.defaultCompanyId,
              bankAccountId: editor.settings?.defaultBankAccountId,
              invoiceDate: todayIso(),
              currency: "INR",
              taxMode: editor.settings?.defaultTaxMode || "automatic",
              termsOfDelivery: editor.settings?.deliveryTerms,
              notes: editor.settings?.defaultNotes,
              declaration: editor.settings?.defaultDeclaration
            }}
          />
          <button className="button" type="submit">
            <FilePlus2 size={18} />
            Create draft
          </button>
        </form>
      </section>
    </AppShell>
  );
}
