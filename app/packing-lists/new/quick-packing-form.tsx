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
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  lines: InvoiceLine[];
};

type Line = {
  key: number;
  invoiceItemId: string;
  itemId: string;
  box: string;
  description: string;
  sku: string;
  hsn: string;
  unit: string;
  quantity: string;
  unitWeight: number;
  net: string;
  gross: string;
  netAuto: boolean;
  grossAuto: boolean;
  length: string;
  width: string;
  height: string;
};

const SHIPMENT_MODES = ["By road", "By sea", "By air", "By courier", "By rail", "Hand delivery"];
const PORT_MODES = new Set(["By sea", "By air"]);

let nextKey = 1;
const round = (value: number) => (value > 0 ? String(Math.round(value * 1000) / 1000) : "");
const blankLine = (box: string): Line => ({
  key: nextKey++, invoiceItemId: "", itemId: "", box, description: "", sku: "", hsn: "", unit: "",
  quantity: "1", unitWeight: 0, net: "", gross: "", netAuto: true, grossAuto: true, length: "", width: "", height: ""
});
const linesFromInvoice = (invoice: PackingInvoice): Line[] =>
  invoice.lines.map((line, index) => {
    const net = round(line.unitWeight * line.quantity);
    return {
      ...blankLine(String(index + 1)),
      invoiceItemId: line.invoiceItemId,
      itemId: line.itemId,
      description: line.description,
      sku: line.sku,
      hsn: line.hsn,
      unit: line.unit,
      quantity: String(line.quantity),
      unitWeight: line.unitWeight,
      net,
      gross: net
    };
  });
const nextBox = (lines: Line[]) => {
  const numbers = lines.map((line) => Number(line.box)).filter((value) => Number.isFinite(value));
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
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
  const [shipmentMode, setShipmentMode] = useState("By road");
  const [route, setRoute] = useState({
    portOfLoading: initialInvoice?.portOfLoading ?? "",
    portOfDischarge: initialInvoice?.portOfDischarge ?? "",
    finalDestination: initialInvoice?.finalDestination ?? "",
    exportReference: initialInvoice?.exportReference ?? ""
  });
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
    setRoute({
      portOfLoading: invoice.portOfLoading,
      portOfDischarge: invoice.portOfDischarge,
      finalDestination: invoice.finalDestination,
      exportReference: invoice.exportReference
    });
    if (invoice.portOfLoading || invoice.portOfDischarge) setShipmentMode("By sea");
    setLines(invoice.lines.length ? linesFromInvoice(invoice) : [blankLine("1")]);
  };

  const update = (key: number, change: (line: Line) => Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change(line) } : line)));

  const pickProduct = (key: number, itemId: string) => {
    const product = products.find((item) => item.id === itemId);
    update(key, (line) => {
      if (!product) return { itemId: "" };
      const net = round(product.unitWeight * (Number(line.quantity) || 0));
      return {
        itemId, invoiceItemId: "", description: product.name, sku: product.sku, hsn: product.hsn, unit: product.unit,
        unitWeight: product.unitWeight, net, gross: net, netAuto: true, grossAuto: true
      };
    });
  };

  const changeQuantity = (key: number, quantity: string) =>
    update(key, (line) => {
      if (!line.netAuto || line.unitWeight <= 0) return { quantity };
      const net = round(line.unitWeight * (Number(quantity) || 0));
      return { quantity, net, gross: line.grossAuto ? net : line.gross };
    });

  const sum = (pick: (line: Line) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const filled = lines.filter((line) => line.description.trim());
  const boxCount = new Set(filled.map((line) => line.box.trim()).filter(Boolean)).size || filled.length;
  const totals = {
    quantity: sum((line) => Number(line.quantity) || 0),
    net: sum((line) => Number(line.net) || 0),
    gross: sum((line) => Number(line.gross) || 0),
    cbm: sum((line) => {
      const l = Number(line.length) || 0, w = Number(line.width) || 0, h = Number(line.height) || 0;
      return l > 0 && w > 0 && h > 0 ? (l * w * h) / 1_000_000 : 0;
    })
  };
  const fmt = (value: number, digits = 2) => value.toLocaleString("en-IN", { maximumFractionDigits: digits });
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
            <p className="muted">Picking an invoice fills in the buyer, products and quantities.</p>
          </div>
          <div className="field">
            <label htmlFor="buyerId">Buyer</label>
            <select id="buyerId" name="buyerId" value={buyerId} onChange={(event) => setBuyerId(event.target.value)} required={!invoiceId}>
              <option value="">Choose a buyer…</option>
              {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="packingListDate">Date</label>
            <input id="packingListDate" name="packingListDate" type="date" defaultValue={defaults.date} required />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>2. What is in each box?</h2>
        <p className="muted">One row per product per box. Weights are in kg, sizes in cm. Use the copy button for identical boxes.</p>
        <div className="quick-lines">
          <div className="pack-line quick-line-head" aria-hidden="true">
            <span>Box no.</span><span>Product</span><span>Qty</span><span>Net kg</span><span>Gross kg</span><span>L × W × H cm</span><span />
          </div>
          {lines.map((line) => (
            <div className="pack-line" key={line.key}>
              <input aria-label="Box number" placeholder="Box no." title="Box / carton number" name="lineBox" value={line.box}
                onChange={(event) => update(line.key, () => ({ box: event.target.value }))} />
              <div className="quick-product">
                {line.invoiceItemId ? null : (
                  <select aria-label="Product" value={line.itemId} onChange={(event) => pickProduct(line.key, event.target.value)}>
                    <option value="">Type your own item…</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>
                    ))}
                  </select>
                )}
                <input aria-label="Description" name="lineDescription" placeholder="Description" value={line.description}
                  onChange={(event) => update(line.key, () => ({ description: event.target.value }))} />
                <input type="hidden" name="lineItemId" value={line.itemId} />
                <input type="hidden" name="lineInvoiceItemId" value={line.invoiceItemId} />
                <input type="hidden" name="lineSku" value={line.sku} />
                <input type="hidden" name="lineHsn" value={line.hsn} />
                <input type="hidden" name="lineUnit" value={line.unit} />
              </div>
              <input aria-label="Quantity" placeholder="Qty" title="Quantity" name="lineQuantity" type="number" min="0" step="0.0001" value={line.quantity}
                onChange={(event) => changeQuantity(line.key, event.target.value)} />
              <input aria-label="Net weight kg" placeholder="Net kg" title="Net weight (kg)" name="lineNet" type="number" min="0" step="0.001" value={line.net}
                onChange={(event) => update(line.key, (current) => ({
                  net: event.target.value, netAuto: false, gross: current.grossAuto ? event.target.value : current.gross
                }))} />
              <input aria-label="Gross weight kg" placeholder="Gross kg" title="Gross weight (kg) including packing" name="lineGross" type="number" min="0" step="0.001" value={line.gross}
                onChange={(event) => update(line.key, () => ({ gross: event.target.value, grossAuto: false }))} />
              <div className="pack-size">
                <input aria-label="Length cm" placeholder="L" title="Length (cm)" name="lineLength" type="number" min="0" step="0.1" value={line.length}
                  onChange={(event) => update(line.key, () => ({ length: event.target.value }))} />
                <input aria-label="Width cm" placeholder="W" title="Width (cm)" name="lineWidth" type="number" min="0" step="0.1" value={line.width}
                  onChange={(event) => update(line.key, () => ({ width: event.target.value }))} />
                <input aria-label="Height cm" placeholder="H" title="Height (cm)" name="lineHeight" type="number" min="0" step="0.1" value={line.height}
                  onChange={(event) => update(line.key, () => ({ height: event.target.value }))} />
              </div>
              <div className="pack-row-actions">
                <button type="button" className="inline-action" aria-label="Copy as next box" title="Copy as next box"
                  onClick={() => setLines((current) => {
                    const index = current.findIndex((item) => item.key === line.key);
                    const copy = { ...line, key: nextKey++, box: nextBox(current) };
                    return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
                  })}>
                  <Copy size={16} />
                </button>
                <button type="button" className="inline-action danger" aria-label="Remove line" title="Remove line"
                  onClick={() => setLines((current) => current.length > 1 ? current.filter((item) => item.key !== line.key) : [blankLine("1")])}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="button subtle" onClick={() => setLines((current) => [...current, blankLine(nextBox(current))])}>
          <Plus size={16} /> Add another box / product
        </button>
        <div className="quick-totals">
          <span>Boxes <strong>{boxCount}</strong></span>
          <span>Quantity <strong>{fmt(totals.quantity, 4)}</strong></span>
          <span>Net <strong>{fmt(totals.net, 3)} kg</strong></span>
          <span>Gross <strong>{fmt(totals.gross, 3)} kg</strong></span>
          <span>Volume <strong>{fmt(totals.cbm, 4)} CBM</strong></span>
        </div>
      </section>

      <section className="panel">
        <h2>3. How is it going?</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="shipmentMode">Sent by</label>
            <select id="shipmentMode" name="shipmentMode" value={shipmentMode} onChange={(event) => setShipmentMode(event.target.value)}>
              {SHIPMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="finalDestination">Destination (city / country)</label>
            <input id="finalDestination" name="finalDestination" value={route.finalDestination}
              onChange={(event) => setRoute({ ...route, finalDestination: event.target.value })} />
          </div>
          {needsPorts ? (
            <>
              <div className="field">
                <label htmlFor="portOfLoading">Port of loading</label>
                <input id="portOfLoading" name="portOfLoading" value={route.portOfLoading}
                  onChange={(event) => setRoute({ ...route, portOfLoading: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="portOfDischarge">Port of discharge</label>
                <input id="portOfDischarge" name="portOfDischarge" value={route.portOfDischarge}
                  onChange={(event) => setRoute({ ...route, portOfDischarge: event.target.value })} />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <details className="panel details">
        <summary>More details (company, container, seal, notes)</summary>
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
            <label htmlFor="exportReference">Exporter reference</label>
            <input id="exportReference" name="exportReference" value={route.exportReference}
              onChange={(event) => setRoute({ ...route, exportReference: event.target.value })} />
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
          <label htmlFor="notes">Notes / marks on boxes</label>
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
