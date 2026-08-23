import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoiceEditorData } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export default async function NewInvoicePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");
  const { companies, buyers, bankAccounts, settings } = await getInvoiceEditorData(context);

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
          <div className="form-grid three">
            <div className="field">
              <label htmlFor="companyId">Company</label>
              <select id="companyId" name="companyId" defaultValue={settings?.defaultCompanyId || ""}>
                <option value="">None</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="buyerId">Buyer</label>
              <select id="buyerId" name="buyerId" defaultValue="">
                <option value="">None</option>
                {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.displayName}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bankAccountId">Bank account</label>
              <select id="bankAccountId" name="bankAccountId" defaultValue={settings?.defaultBankAccountId || ""}>
                <option value="">None</option>
                {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} - {account.accountNumberLast4}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid three">
            <div className="field"><label htmlFor="invoiceDate">Invoice date</label><input id="invoiceDate" name="invoiceDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
            <div className="field"><label htmlFor="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" /></div>
            <div className="field"><label htmlFor="currency">Currency</label><input id="currency" name="currency" defaultValue="INR" required /></div>
          </div>
          <div className="field">
            <label htmlFor="taxMode">Tax mode</label>
            <select id="taxMode" name="taxMode" defaultValue={settings?.defaultTaxMode || "automatic"}>
              <option value="automatic">Automatic</option>
              <option value="igst">IGST</option>
              <option value="cgst_sgst">CGST + SGST</option>
              <option value="zero_rated_export">Zero-rated export</option>
              <option value="no_tax">No tax</option>
            </select>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="buyerOrderNumber">Buyer order number</label><input id="buyerOrderNumber" name="buyerOrderNumber" /></div>
            <div className="field"><label htmlFor="exporterReference">Exporter reference</label><input id="exporterReference" name="exporterReference" /></div>
          </div>
          <details className="details">
            <summary>Shipping and export fields</summary>
            <div className="form-grid">
              <div className="field"><label htmlFor="preCarriageBy">Pre-carriage by</label><input id="preCarriageBy" name="preCarriageBy" /></div>
              <div className="field"><label htmlFor="placeOfReceipt">Place of receipt</label><input id="placeOfReceipt" name="placeOfReceipt" /></div>
              <div className="field"><label htmlFor="vesselFlightNo">Vessel/flight no.</label><input id="vesselFlightNo" name="vesselFlightNo" /></div>
              <div className="field"><label htmlFor="portOfLoading">Port of loading</label><input id="portOfLoading" name="portOfLoading" /></div>
              <div className="field"><label htmlFor="portOfDischarge">Port of discharge</label><input id="portOfDischarge" name="portOfDischarge" /></div>
              <div className="field"><label htmlFor="finalDestination">Final destination</label><input id="finalDestination" name="finalDestination" /></div>
            </div>
            <div className="field"><label htmlFor="termsOfDelivery">Terms of delivery and payment</label><textarea id="termsOfDelivery" name="termsOfDelivery" /></div>
          </details>
          <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" defaultValue={settings?.defaultNotes || ""} /></div>
          <div className="field"><label htmlFor="declaration">Declaration</label><textarea id="declaration" name="declaration" defaultValue={settings?.defaultDeclaration || ""} /></div>
          <input type="hidden" name="invoiceDiscount" value="0" />
          <input type="hidden" name="otherCharges" value="0" />
          <button className="button" type="submit">
            <FilePlus2 size={18} />
            Create draft
          </button>
        </form>
      </section>
    </AppShell>
  );
}
