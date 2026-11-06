"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Product = { id: string; name: string; sku: string | null; rate: string; gst: string; hsn: string | null; unit: string | null };
type Option = { id: string; label: string };

export type QuickInvoiceProps = {
  products: Product[];
  buyers: Option[];
  companies: Option[];
  bankAccounts: Option[];
  defaults: { companyId: string; bankAccountId: string; invoiceDate: string; taxMode: string; notes: string };
  canIssue: boolean;
};

type Line = { key: number; itemId: string; description: string; hsn: string; unit: string; quantity: string; rate: string; gst: string };

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, itemId: "", description: "", hsn: "", unit: "", quantity: "1", rate: "", gst: "" });

export function QuickInvoiceForm({ products, buyers, companies, bankAccounts, defaults, canIssue }: QuickInvoiceProps) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const pickProduct = (key: number, itemId: string) => {
    const product = productById.get(itemId);
    update(key, product
      ? { itemId, description: product.name, hsn: product.hsn ?? "", unit: product.unit ?? "", rate: product.rate, gst: product.gst }
      : { itemId: "" });
  };

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0), 0);
  const tax = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0) * (Number(line.gst) || 0) / 100, 0);
  const filled = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
  const money = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form className="quick-invoice" action="/api/invoices/quick" method="post">
      <section className="panel">
        <h2>1. Who is it for?</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="buyerId">Buyer</label>
            <select id="buyerId" name="buyerId" required defaultValue="">
              <option value="" disabled>Choose a buyer…</option>
              {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.label}</option>)}
            </select>
            {buyers.length === 0 ? <p className="muted">Add a buyer first under Buyers.</p> : null}
          </div>
          <div className="field">
            <label htmlFor="invoiceDate">Invoice date</label>
            <input id="invoiceDate" name="invoiceDate" type="date" defaultValue={defaults.invoiceDate} required />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>2. What did you sell?</h2>
        <div className="quick-lines">
          <div className="quick-line quick-line-head" aria-hidden="true">
            <span>Product</span><span>Qty</span><span>Rate</span><span>GST %</span><span>Amount</span><span />
          </div>
          {lines.map((line) => {
            const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
            return (
              <div className="quick-line" key={line.key}>
                <div className="quick-product">
                  <select aria-label="Product" value={line.itemId} onChange={(event) => pickProduct(line.key, event.target.value)}>
                    <option value="">Type your own item…</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>
                    ))}
                  </select>
                  <input aria-label="Description" name="lineDescription" placeholder="Description" value={line.description}
                    onChange={(event) => update(line.key, { description: event.target.value })} />
                  <input type="hidden" name="lineItemId" value={line.itemId} />
                  <input type="hidden" name="lineHsn" value={line.hsn} />
                  <input type="hidden" name="lineUnit" value={line.unit} />
                </div>
                <input aria-label="Quantity" placeholder="Qty" title="Quantity" name="lineQuantity" type="number" min="0.0001" step="0.0001" value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value })} />
                <input aria-label="Rate" placeholder="Rate" title="Rate" name="lineRate" type="number" min="0" step="0.01" value={line.rate}
                  onChange={(event) => update(line.key, { rate: event.target.value })} />
                <input aria-label="GST %" placeholder="GST %" title="GST %" name="lineGst" type="number" min="0" max="100" step="0.01" value={line.gst}
                  onChange={(event) => update(line.key, { gst: event.target.value })} />
                <strong className="quick-amount">{money(amount)}</strong>
                <button type="button" className="inline-action danger" aria-label="Remove line"
                  onClick={() => setLines((current) => current.length > 1 ? current.filter((item) => item.key !== line.key) : [emptyLine()])}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="button subtle" onClick={() => setLines((current) => [...current, emptyLine()])}>
          <Plus size={16} /> Add another product
        </button>
        <div className="quick-totals">
          <span>Subtotal <strong>{money(subtotal)}</strong></span>
          <span>GST <strong>{money(tax)}</strong></span>
          <span className="quick-grand">Total (approx.) <strong>{money(subtotal + tax)}</strong></span>
        </div>
        <p className="muted">Final GST split (CGST+SGST or IGST) and rounding are worked out when you save.</p>
      </section>

      <details className="panel details">
        <summary>More details (company, bank, tax, notes)</summary>
        <div className="form-grid">
          {companies.length > 1 ? (
            <div className="field">
              <label htmlFor="companyId">Company</label>
              <select id="companyId" name="companyId" defaultValue={defaults.companyId}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
              </select>
            </div>
          ) : <input type="hidden" name="companyId" value={defaults.companyId} />}
          <div className="field">
            <label htmlFor="bankAccountId">Bank account on invoice</label>
            <select id="bankAccountId" name="bankAccountId" defaultValue={defaults.bankAccountId}>
              <option value="">None</option>
              {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <input id="currency" name="currency" defaultValue="INR" maxLength={3} />
          </div>
          <div className="field">
            <label htmlFor="taxMode">GST type</label>
            <select id="taxMode" name="taxMode" defaultValue={defaults.taxMode}>
              <option value="automatic">Automatic (same state = CGST+SGST, else IGST)</option>
              <option value="igst">IGST</option>
              <option value="cgst_sgst">CGST + SGST</option>
              <option value="zero_rated_export">Export (zero-rated)</option>
              <option value="no_tax">No tax</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="buyerOrderNumber">Buyer order number</label>
            <input id="buyerOrderNumber" name="buyerOrderNumber" />
          </div>
          <div className="field">
            <label htmlFor="dueDate">Due date</label>
            <input id="dueDate" name="dueDate" type="date" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" defaultValue={defaults.notes} />
        </div>
      </details>

      <div className="quick-actions">
        <button className="button subtle" type="submit" name="intent" value="draft" disabled={!filled.length}>Save draft</button>
        {canIssue ? (
          <button className="button" type="submit" name="intent" value="issue" disabled={!filled.length}>Save &amp; issue invoice</button>
        ) : null}
      </div>
    </form>
  );
}
