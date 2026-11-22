"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

type Option = { id: string; label: string };
type Product = { id: string; name: string; sku: string; hsn: string; unit: string; unitWeight: number };
type InvoiceLine = {
  invoiceItemId: string;
  itemId: string;
  description: string;
  sku: string;
  hsn: string;
  unit: string;
  quantity: number;
  unitWeight: number;
};
export type PackingInvoice = {
  id: string;
  label: string;
  companyId: string;
  buyerId: string;
  exportReference: string;
  buyerOrderNumber: string;
  buyerOrderDate: string;
  preCarriageBy: string;
  placeOfReceipt: string;
  vesselFlightNo: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  termsOfDelivery: string;
  lines: InvoiceLine[];
};

/** One carton-wise row: cartons "from" to "to", each holding the same product. */
type Line = {
  key: number;
  invoiceItemId: string;
  itemId: string;
  from: string;
  to: string;
  sku: string;
  description: string;
  hsn: string;
  unit: string;
  pcsPerCtn: string;
  netPerPc: string;
  grossPerCtn: string;
  length: string;
  width: string;
  height: string;
  marks: string;
};

const SHIPMENT_MODES = ["By road", "By sea", "By air", "By courier", "By rail", "Hand delivery"];
const PORT_MODES = new Set(["By sea", "By air"]);

let nextKey = 1;
const trim3 = (value: number) => (value > 0 ? String(Math.round(value * 1000) / 1000) : "");
const blankLine = (from: string): Line => ({
  key: nextKey++, invoiceItemId: "", itemId: "", from, to: "", sku: "", description: "", hsn: "", unit: "",
  pcsPerCtn: "", netPerPc: "", grossPerCtn: "", length: "", width: "", height: "", marks: ""
});
const linesFromInvoice = (invoice: PackingInvoice): Line[] =>
  invoice.lines.map((line, index) => ({
    ...blankLine(String(index + 1)),
    invoiceItemId: line.invoiceItemId,
    itemId: line.itemId,
    description: line.description,
    sku: line.sku,
    hsn: line.hsn,
    unit: line.unit,
    // Starts as one carton holding the whole invoiced quantity; change the range and pcs/CTN to split it.
    pcsPerCtn: String(line.quantity),
    netPerPc: trim3(line.unitWeight)
  }));

const cartonsOf = (line: Line) => {
  const from = Number(line.from) || 0;
  const to = Number(line.to) || from;
  return from > 0 && to >= from ? to - from + 1 : 1;
};
const lastCarton = (line: Line) => (Number(line.to) || Number(line.from) || 0);
const nextFrom = (lines: Line[]) => String(Math.max(0, ...lines.map(lastCarton)) + 1);
const lineTotals = (line: Line) => {
  const cartons = cartonsOf(line);
  const quantity = (Number(line.pcsPerCtn) || 0) * cartons;
  const net = (Number(line.netPerPc) || 0) * quantity;
  const gross = (Number(line.grossPerCtn) || 0) * cartons;
  const l = Number(line.length) || 0, w = Number(line.width) || 0, h = Number(line.height) || 0;
  const cbm = l > 0 && w > 0 && h > 0 ? (l * w * h * cartons) / 1_000_000 : 0;
  return { cartons, quantity, net, gross, cbm };
};

export function QuickPackingForm({ invoices, products, buyers, companies, defaults, canIssue }: {
  invoices: PackingInvoice[];
  products: Product[];
  buyers: Option[];
  companies: Option[];
  defaults: { companyId: string; date: string; invoiceId: string };
  canIssue: boolean;
}) {
  const initialInvoice = invoices.find((invoice) => invoice.id === defaults.invoiceId);
  const [invoiceId, setInvoiceId] = useState(initialInvoice?.id ?? "");
  const [buyerId, setBuyerId] = useState(initialInvoice?.buyerId ?? "");
  const [companyId, setCompanyId] = useState(initialInvoice?.companyId || defaults.companyId);
  const [shipmentMode, setShipmentMode] = useState(initialInvoice?.portOfLoading ? "By sea" : "By road");
  const headerFrom = (invoice?: PackingInvoice) => ({
    exportReference: invoice?.exportReference ?? "",
    buyerOrderNumber: invoice?.buyerOrderNumber ?? "",
    buyerOrderDate: invoice?.buyerOrderDate ?? "",
    preCarriageBy: invoice?.preCarriageBy ?? "",
    placeOfReceipt: invoice?.placeOfReceipt ?? "",
    vesselFlightNo: invoice?.vesselFlightNo ?? "",
    portOfLoading: invoice?.portOfLoading ?? "",
    portOfDischarge: invoice?.portOfDischarge ?? "",
    finalDestination: invoice?.finalDestination ?? "",
    termsOfDelivery: invoice?.termsOfDelivery ?? ""
  });
  const [header, setHeader] = useState(() => headerFrom(initialInvoice));
  const [lines, setLines] = useState<Line[]>(() => (initialInvoice ? linesFromInvoice(initialInvoice) : [blankLine("1")]));

  const chooseInvoice = (id: string) => {
    setInvoiceId(id);
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) {
      setLines((current) => current.map((line) => ({ ...line, invoiceItemId: "" })));
      return;
    }
    setBuyerId(invoice.buyerId);
    if (invoice.companyId) setCompanyId(invoice.companyId);
    setHeader(headerFrom(invoice));
    if (invoice.portOfLoading || invoice.portOfDischarge) setShipmentMode("By sea");
    setLines(invoice.lines.length ? linesFromInvoice(invoice) : [blankLine("1")]);
  };

  const field = (name: keyof typeof header) => ({
    id: name,
    name,
    value: header[name],
    onChange: (event: { target: { value: string } }) => setHeader((current) => ({ ...current, [name]: event.target.value }))
  });

  const update = (key: number, change: (line: Line) => Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change(line) } : line)));

  const pickProduct = (key: number, itemId: string) => {
    const product = products.find((item) => item.id === itemId);
    update(key, () => product
      ? { itemId, invoiceItemId: "", description: product.name, sku: product.sku, hsn: product.hsn, unit: product.unit, netPerPc: trim3(product.unitWeight) }
      : { itemId: "" });
  };

  const filled = lines.filter((line) => line.description.trim());
  const totals = filled.reduce(
    (sum, line) => {
      const row = lineTotals(line);
      return { cartons: sum.cartons + row.cartons, quantity: sum.quantity + row.quantity, net: sum.net + row.net, gross: sum.gross + row.gross, cbm: sum.cbm + row.cbm };
    },
    { cartons: 0, quantity: 0, net: 0, gross: 0, cbm: 0 }
  );
  const fmt = (value: number, digits = 3) => value.toLocaleString("en-IN", { minimumFractionDigits: digits === 3 ? 3 : 0, maximumFractionDigits: digits });
  const needsPorts = PORT_MODES.has(shipmentMode);

  return (
    <form className="quick-invoice" action="/api/packing-lists/quick" method="post">
      <section className="panel">
        <h2>1. Who is it for?</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="invoiceId">Copy from invoice (optional)</label>
            <select id="invoiceId" name="invoiceId" value={invoiceId} onChange={(event) => chooseInvoice(event.target.value)}>
              <option value="">No invoice - I will pick products</option>
              {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.label}</option>)}
            </select>
            <p className="muted">Picking an invoice fills in the buyer, products, quantities and shipping details.</p>
          </div>
          <div className="field">
            <label htmlFor="buyerId">Buyer / consignee</label>
            <select id="buyerId" name="buyerId" value={buyerId} onChange={(event) => setBuyerId(event.target.value)} required={!invoiceId}>
              <option value="">Choose a buyer…</option>
              {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="packingListDate">Date</label>
            <input id="packingListDate" name="packingListDate" type="date" defaultValue={defaults.date} required />
          </div>
          <div className="field">
            <label htmlFor="buyerOrderNumber">Buyer&apos;s order no.</label>
            <input {...field("buyerOrderNumber")} />
          </div>
          <div className="field">
            <label htmlFor="buyerOrderDate">Buyer&apos;s order date</label>
            <input {...field("buyerOrderDate")} type="date" />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>2. Cartons</h2>
        <p className="muted">
          One row per group of identical cartons, e.g. cartons 2 to 8 with 10 pcs each. Quantity, net and gross weight are worked out
          from pcs per carton, net kg per piece and gross kg per carton. Sizes are per carton, in cm.
        </p>
        <div className="quick-lines">
          <div className="pack-line ctn quick-line-head" aria-hidden="true">
            <span>CTN no. from – to</span><span>Item no.</span><span>Description</span><span>Pcs / CTN</span><span>Net kg / pc</span><span>Gross kg / CTN</span><span>CTN size L × W × H</span><span />
          </div>
          {lines.map((line) => {
            const row = lineTotals(line);
            return (
              <div className="pack-line-group" key={line.key}>
                <div className="pack-line ctn">
                  <div className="pack-range">
                    <label className="pack-cell"><span>CTN from</span>
                      <input aria-label="First carton number" placeholder="From" name="lineCtnFrom" type="number" min="1" step="1" value={line.from}
                        onChange={(event) => update(line.key, () => ({ from: event.target.value }))} /></label>
                    <label className="pack-cell"><span>CTN to</span>
                      <input aria-label="Last carton number" placeholder="To" name="lineCtnTo" type="number" min="1" step="1" value={line.to}
                        onChange={(event) => update(line.key, () => ({ to: event.target.value }))} /></label>
                  </div>
                  <label className="pack-cell"><span>Item no.</span>
                    <input aria-label="Item number" placeholder="Item no." name="lineSku" value={line.sku}
                      onChange={(event) => update(line.key, () => ({ sku: event.target.value }))} /></label>
                  <div className="quick-product">
                    {line.invoiceItemId ? null : (
                      <select aria-label="Product" value={line.itemId} onChange={(event) => pickProduct(line.key, event.target.value)}>
                        <option value="">Type your own item…</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>
                        ))}
                      </select>
                    )}
                    <input aria-label="Description" name="lineDescription" placeholder="Description of goods" value={line.description}
                      onChange={(event) => update(line.key, () => ({ description: event.target.value }))} />
                    <input aria-label="Marks" name="lineMarks" placeholder="Marks (optional)" value={line.marks}
                      onChange={(event) => update(line.key, () => ({ marks: event.target.value }))} />
                    <input type="hidden" name="lineItemId" value={line.itemId} />
                    <input type="hidden" name="lineInvoiceItemId" value={line.invoiceItemId} />
                    <input type="hidden" name="lineHsn" value={line.hsn} />
                    <input type="hidden" name="lineUnit" value={line.unit} />
                  </div>
                  <label className="pack-cell"><span>Pcs / CTN</span>
                    <input aria-label="Pieces per carton" placeholder="Pcs" name="linePcsPerCtn" type="number" min="0" step="0.0001" value={line.pcsPerCtn}
                      onChange={(event) => update(line.key, () => ({ pcsPerCtn: event.target.value }))} /></label>
                  <label className="pack-cell"><span>Net kg / pc</span>
                    <input aria-label="Net weight per piece kg" placeholder="Net/pc" name="lineNetPerPc" type="number" min="0" step="0.001" value={line.netPerPc}
                      onChange={(event) => update(line.key, () => ({ netPerPc: event.target.value }))} /></label>
                  <label className="pack-cell"><span>Gross kg / CTN</span>
                    <input aria-label="Gross weight per carton kg" placeholder="Gross/CTN" name="lineGrossPerCtn" type="number" min="0" step="0.001" value={line.grossPerCtn}
                      onChange={(event) => update(line.key, () => ({ grossPerCtn: event.target.value }))} /></label>
                  <div className="pack-size">
                    <label className="pack-cell"><span>L cm</span>
                      <input aria-label="Carton length cm" placeholder="L" name="lineLength" type="number" min="0" step="0.1" value={line.length}
                        onChange={(event) => update(line.key, () => ({ length: event.target.value }))} /></label>
                    <label className="pack-cell"><span>W cm</span>
                      <input aria-label="Carton width cm" placeholder="W" name="lineWidth" type="number" min="0" step="0.1" value={line.width}
                        onChange={(event) => update(line.key, () => ({ width: event.target.value }))} /></label>
                    <label className="pack-cell"><span>H cm</span>
                      <input aria-label="Carton height cm" placeholder="H" name="lineHeight" type="number" min="0" step="0.1" value={line.height}
                        onChange={(event) => update(line.key, () => ({ height: event.target.value }))} /></label>
                  </div>
                  <div className="pack-row-actions">
                    <button type="button" className="inline-action" aria-label="Copy as next cartons" title="Copy as the next cartons"
                      onClick={() => setLines((current) => {
                        const from = Number(nextFrom(current));
                        return [...current, { ...line, key: nextKey++, invoiceItemId: "", from: String(from), to: line.to ? String(from + cartonsOf(line) - 1) : "" }];
                      })}>
                      <Copy size={16} />
                    </button>
                    <button type="button" className="inline-action danger" aria-label="Remove row" title="Remove row"
                      onClick={() => setLines((current) => current.length > 1 ? current.filter((item) => item.key !== line.key) : [blankLine("1")])}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="pack-line-summary muted">
                  {row.cartons} {row.cartons === 1 ? "carton" : "cartons"} · {fmt(row.quantity, 4)} pcs · net {fmt(row.net)} kg · gross {fmt(row.gross)} kg
                  {row.cbm > 0 ? ` · ${fmt(row.cbm)} CBM` : ""}
                </p>
              </div>
            );
          })}
        </div>
        <button type="button" className="button subtle" onClick={() => setLines((current) => [...current, blankLine(nextFrom(current))])}>
          <Plus size={16} /> Add cartons
        </button>
        <div className="quick-totals">
          <span>Cartons <strong>{totals.cartons}</strong></span>
          <span>Quantity <strong>{fmt(totals.quantity, 4)} pcs</strong></span>
          <span>Net <strong>{fmt(totals.net)} kg</strong></span>
          <span>Gross <strong>{fmt(totals.gross)} kg</strong></span>
          <span>Volume <strong>{fmt(totals.cbm)} CBM</strong></span>
        </div>
      </section>

      <section className="panel">
        <h2>3. Shipping</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="shipmentMode">Sent by</label>
            <select id="shipmentMode" name="shipmentMode" value={shipmentMode} onChange={(event) => setShipmentMode(event.target.value)}>
              {SHIPMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="preCarriageBy">Pre-carriage by</label>
            <input {...field("preCarriageBy")} placeholder="Transport" />
          </div>
          <div className="field">
            <label htmlFor="placeOfReceipt">Place of receipt by pre-carrier</label>
            <input {...field("placeOfReceipt")} />
          </div>
          {needsPorts ? (
            <>
              <div className="field">
                <label htmlFor="vesselFlightNo">Vessel / flight no.</label>
                <input {...field("vesselFlightNo")} />
              </div>
              <div className="field">
                <label htmlFor="portOfLoading">Port of loading</label>
                <input {...field("portOfLoading")} />
              </div>
              <div className="field">
                <label htmlFor="portOfDischarge">Port of discharge</label>
                <input {...field("portOfDischarge")} />
              </div>
            </>
          ) : null}
          <div className="field">
            <label htmlFor="finalDestination">Port / place of final destination</label>
            <input {...field("finalDestination")} />
          </div>
          <div className="field">
            <label htmlFor="countryOfOrigin">Country of origin</label>
            <input id="countryOfOrigin" name="countryOfOrigin" defaultValue="India" />
          </div>
          <div className="field">
            <label htmlFor="countryOfFinalDestination">Country of final destination</label>
            <input id="countryOfFinalDestination" name="countryOfFinalDestination" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="termsOfDelivery">Terms of delivery and payment</label>
          <textarea {...field("termsOfDelivery")} rows={2} />
        </div>
      </section>

      <details className="panel details">
        <summary>More details (company, exporter&apos;s ref., container, seal, declaration)</summary>
        <div className="form-grid">
          {companies.length > 1 ? (
            <div className="field">
              <label htmlFor="companyId">Company</label>
              <select id="companyId" name="companyId" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
              </select>
            </div>
          ) : <input type="hidden" name="companyId" value={companyId} />}
          <div className="field">
            <label htmlFor="exportReference">Exporter&apos;s ref. (blank = IEC)</label>
            <input {...field("exportReference")} />
          </div>
          <div className="field">
            <label htmlFor="containerNumber">Container no.</label>
            <input id="containerNumber" name="containerNumber" />
          </div>
          <div className="field">
            <label htmlFor="sealNumber">Seal no.</label>
            <input id="sealNumber" name="sealNumber" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Declaration (blank = standard declaration)</label>
          <textarea id="notes" name="notes" />
        </div>
      </details>

      <div className="quick-actions">
        <button className="button subtle" type="submit" name="intent" value="draft" disabled={!filled.length}>Save draft</button>
        {canIssue ? (
          <button className="button" type="submit" name="intent" value="issue" disabled={!filled.length}>Save &amp; make PDF</button>
        ) : null}
      </div>
    </form>
  );
}
