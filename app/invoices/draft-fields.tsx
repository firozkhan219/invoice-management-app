import type { getInvoiceEditorData } from "@/lib/invoices/invoice-service";

type EditorData = Awaited<ReturnType<typeof getInvoiceEditorData>>;

type DraftValues = {
  companyId?: string | null;
  buyerId?: string | null;
  consigneeBuyerId?: string | null;
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  bankAccountId?: string | null;
  invoiceDate?: string;
  dueDate?: string | null;
  currency?: string;
  placeOfSupplyStateCode?: string | null;
  taxMode?: string;
  buyerOrderNumber?: string | null;
  buyerOrderDate?: string | null;
  exporterReference?: string | null;
  preCarriageBy?: string | null;
  placeOfReceipt?: string | null;
  vesselFlightNo?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  termsOfDelivery?: string | null;
  notes?: string | null;
  declaration?: string | null;
  invoiceDiscount?: string;
  otherCharges?: string;
};

/** Shared fields for the "new draft" and "update draft" forms. */
export function DraftFields({ editor, values }: { editor: EditorData; values: DraftValues }) {
  const addressGroups = editor.buyers.filter((buyer) => buyer.addresses.length > 0);
  const addressOptions = addressGroups.map((buyer) => (
    <optgroup key={buyer.id} label={buyer.displayName}>
      {buyer.addresses.map((address) => (
        <option key={address.id} value={address.id}>
          {address.label} — {address.city}, {address.state}{address.stateCode ? ` (${address.stateCode})` : ""}
        </option>
      ))}
    </optgroup>
  ));

  return (
    <>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor="companyId">Company</label>
          <select id="companyId" name="companyId" defaultValue={values.companyId || ""}>
            <option value="">None</option>
            {editor.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName}{company.stateCode ? ` (state ${company.stateCode})` : " (no state code)"}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="buyerId">Buyer</label>
          <select id="buyerId" name="buyerId" defaultValue={values.buyerId || ""}>
            <option value="">None</option>
            {editor.buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.displayName}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bankAccountId">Bank account</label>
          <select id="bankAccountId" name="bankAccountId" defaultValue={values.bankAccountId || ""}>
            <option value="">None</option>
            {editor.bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.bankName} - {account.accountNumberLast4} ({account.currency})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor="billingAddressId">Billing address</label>
          <select id="billingAddressId" name="billingAddressId" defaultValue={values.billingAddressId || ""}>
            <option value="">Not set</option>
            {addressOptions}
          </select>
        </div>
        <div className="field">
          <label htmlFor="consigneeBuyerId">Consignee (if different)</label>
          <select id="consigneeBuyerId" name="consigneeBuyerId" defaultValue={values.consigneeBuyerId || ""}>
            <option value="">Same as buyer</option>
            {editor.buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.displayName}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="shippingAddressId">Shipping address</label>
          <select id="shippingAddressId" name="shippingAddressId" defaultValue={values.shippingAddressId || ""}>
            <option value="">Not set</option>
            {addressOptions}
          </select>
        </div>
      </div>
      <div className="form-grid three">
        <div className="field"><label htmlFor="invoiceDate">Invoice date</label><input id="invoiceDate" name="invoiceDate" type="date" defaultValue={values.invoiceDate} required /></div>
        <div className="field"><label htmlFor="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate || ""} /></div>
        <div className="field"><label htmlFor="currency">Currency</label><input id="currency" name="currency" defaultValue={values.currency || "INR"} required maxLength={3} /></div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="taxMode">Tax mode</label>
          <select id="taxMode" name="taxMode" defaultValue={values.taxMode || "automatic"}>
            <option value="automatic">Automatic (compare company state with place of supply)</option>
            <option value="igst">IGST</option>
            <option value="cgst_sgst">CGST + SGST</option>
            <option value="zero_rated_export">Zero-rated export</option>
            <option value="no_tax">No tax</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="placeOfSupplyStateCode">Place of supply (state code)</label>
          <input id="placeOfSupplyStateCode" name="placeOfSupplyStateCode" maxLength={10} placeholder="Blank = shipping/billing address state" defaultValue={values.placeOfSupplyStateCode || ""} />
        </div>
      </div>
      <div className="form-grid three">
        <div className="field"><label htmlFor="buyerOrderNumber">Buyer order number</label><input id="buyerOrderNumber" name="buyerOrderNumber" defaultValue={values.buyerOrderNumber || ""} /></div>
        <div className="field"><label htmlFor="buyerOrderDate">Buyer order date</label><input id="buyerOrderDate" name="buyerOrderDate" type="date" defaultValue={values.buyerOrderDate || ""} /></div>
        <div className="field"><label htmlFor="exporterReference">Exporter reference</label><input id="exporterReference" name="exporterReference" defaultValue={values.exporterReference || ""} /></div>
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="invoiceDiscount">Invoice discount (amount)</label><input id="invoiceDiscount" name="invoiceDiscount" type="number" min="0" step="0.01" defaultValue={values.invoiceDiscount || "0"} /></div>
        <div className="field"><label htmlFor="otherCharges">Other charges (amount)</label><input id="otherCharges" name="otherCharges" type="number" min="0" step="0.01" defaultValue={values.otherCharges || "0"} /></div>
      </div>
      <details className="details">
        <summary>Shipping and export fields</summary>
        <div className="form-grid">
          <div className="field"><label htmlFor="preCarriageBy">Pre-carriage by</label><input id="preCarriageBy" name="preCarriageBy" defaultValue={values.preCarriageBy || ""} /></div>
          <div className="field"><label htmlFor="placeOfReceipt">Place of receipt</label><input id="placeOfReceipt" name="placeOfReceipt" defaultValue={values.placeOfReceipt || ""} /></div>
          <div className="field"><label htmlFor="vesselFlightNo">Vessel/flight no.</label><input id="vesselFlightNo" name="vesselFlightNo" defaultValue={values.vesselFlightNo || ""} /></div>
          <div className="field"><label htmlFor="portOfLoading">Port of loading</label><input id="portOfLoading" name="portOfLoading" defaultValue={values.portOfLoading || ""} /></div>
          <div className="field"><label htmlFor="portOfDischarge">Port of discharge</label><input id="portOfDischarge" name="portOfDischarge" defaultValue={values.portOfDischarge || ""} /></div>
          <div className="field"><label htmlFor="finalDestination">Final destination</label><input id="finalDestination" name="finalDestination" defaultValue={values.finalDestination || ""} /></div>
        </div>
        <div className="field"><label htmlFor="termsOfDelivery">Terms of delivery and payment</label><textarea id="termsOfDelivery" name="termsOfDelivery" defaultValue={values.termsOfDelivery || ""} /></div>
      </details>
      <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" defaultValue={values.notes || ""} /></div>
      <div className="field"><label htmlFor="declaration">Declaration</label><textarea id="declaration" name="declaration" defaultValue={values.declaration || ""} /></div>
    </>
  );
}

export function isoDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
