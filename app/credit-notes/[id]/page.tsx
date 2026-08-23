import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Save, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getCreditNote, getCreditNoteWorkspace } from "@/lib/credit-notes/credit-note-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";

export default async function CreditNoteDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");
  const { id } = await params;
  const creditNote = await getCreditNote(context, id);
  if (!creditNote) redirect("/credit-notes");
  const workspace = await getCreditNoteWorkspace(context);
  const query = await searchParams;
  const isDraft = creditNote.status === "draft";
  const canIssue = isDraft && creditNote.lines.length > 0 && creditNote.grandTotal.gt(0) && workspace.series.length > 0;
  const original = creditNote.originalInvoice;

  return (
    <AppShell>
      {query?.error ? <p className="notice error">{query.error}</p> : null}
      <header className="page-header">
        <div>
          <p className="muted">Credit note</p>
          <h1>{creditNote.creditNoteNumber || "Draft credit note"}</h1>
          <div className="meta-row">
            <span className={`status-badge ${creditNote.status}`}>{creditNote.status}</span>
            <span>{creditNote.creditNoteDate.toISOString().slice(0, 10)}</span>
            <span>Against {original.invoiceNumber || original.id}</span>
          </div>
        </div>
        <div className="toolbar">
          <Link className="button subtle" href="/credit-notes">Credit Notes</Link>
          <Link className="button subtle" href={`/invoices/${original.id}`}>Original invoice</Link>
          {creditNote.status === "issued" ? (
            <a className="button" href={`/api/credit-notes/${creditNote.id}/pdf`} target="_blank" rel="noreferrer">
              <FileText size={18} />
              Open PDF
            </a>
          ) : null}
        </div>
      </header>

      <div className="summary-grid">
        <div className="stat"><span className="muted">Credit total</span><strong>{creditNote.currency} {creditNote.grandTotal.toString()}</strong></div>
        <div className="stat"><span className="muted">Original invoice</span><strong>{original.invoiceNumber || "-"}</strong></div>
        <div className="stat"><span className="muted">Original total</span><strong>{original.currency} {original.grandTotal.toString()}</strong></div>
      </div>

      <div className="grid two-column">
        <div className="grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Snapshot</p>
                <h2>Original invoice reference</h2>
              </div>
            </div>
            <table className="table compact">
              <tbody>
                <tr><th>Invoice</th><td>{original.invoiceNumber || "-"}</td></tr>
                <tr><th>Invoice date</th><td>{original.invoiceDate.toISOString().slice(0, 10)}</td></tr>
                <tr><th>Company</th><td>{original.company?.legalName || snapshotText(creditNote.originalInvoiceSnapshot, "company", "legalName") || "-"}</td></tr>
                <tr><th>Buyer</th><td>{original.buyer?.displayName || snapshotText(creditNote.originalInvoiceSnapshot, "buyer", "displayName") || "-"}</td></tr>
                <tr><th>Tax mode</th><td>{original.taxMode}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Selected credits</p>
                <h2>Credit note lines</h2>
              </div>
              <span className="badge">{creditNote.lines.length} lines</span>
            </div>
            {creditNote.lines.length === 0 ? (
              <p className="muted">No credited lines selected yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Total</th>{isDraft ? <th>Action</th> : null}</tr></thead>
                  <tbody>
                    {creditNote.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.sortOrder}</td>
                        <td>{line.description}</td>
                        <td>{line.quantity.toString()} {line.unitCode || ""}</td>
                        <td>{line.rate.toString()}</td>
                        <td>{line.gstRate.toString()}%</td>
                        <td>{line.lineTotal.toString()}</td>
                        {isDraft ? (
                          <td>
                            <form action="/api/credit-notes/lines/delete" method="post">
                              <input type="hidden" name="creditNoteId" value={creditNote.id} />
                              <input type="hidden" name="lineId" value={line.id} />
                              <button className="inline-action danger" type="submit">
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isDraft ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Original invoice items</p>
                  <h2>Select lines to credit</h2>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Description</th><th>Original qty</th><th>Rate</th><th>Add credit</th></tr></thead>
                  <tbody>
                    {original.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td>{item.quantity.toString()} {item.unitCode || ""}</td>
                        <td>{item.rate.toString()}</td>
                        <td>
                          <form className="inline-action" action="/api/credit-notes/lines" method="post">
                            <input type="hidden" name="creditNoteId" value={creditNote.id} />
                            <input type="hidden" name="invoiceItemId" value={item.id} />
                            <input aria-label="Credit quantity" name="quantity" type="number" step="0.0001" min="0" max={item.quantity.toString()} defaultValue={item.quantity.toString()} />
                            <input aria-label="Credit rate" name="rate" type="number" step="0.0001" min="0" defaultValue={item.rate.toString()} />
                            <input type="hidden" name="discountAmount" value={item.discountAmount.toString()} />
                            <button className="button" type="submit">Add</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid">
          {isDraft ? (
            <>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <p className="muted">Draft</p>
                    <h2>Update credit note</h2>
                  </div>
                  <Save size={20} />
                </div>
                <form className="form" action="/api/credit-notes/update" method="post">
                  <input type="hidden" name="creditNoteId" value={creditNote.id} />
                  <div className="field">
                    <label htmlFor="creditNoteDate">Credit note date</label>
                    <input id="creditNoteDate" name="creditNoteDate" type="date" defaultValue={creditNote.creditNoteDate.toISOString().slice(0, 10)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="reason">Reason</label>
                    <textarea id="reason" name="reason" defaultValue={creditNote.reason || ""} />
                  </div>
                  <button className="button" type="submit">
                    <Save size={18} />
                    Save draft
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="section-title">
                  <div>
                    <p className="muted">Finalise</p>
                    <h2>Issue credit note</h2>
                  </div>
                  <Send size={20} />
                </div>
                {workspace.series.length === 0 ? (
                  <p className="notice error">Create a credit note number series in Settings first.</p>
                ) : null}
                {creditNote.lines.length === 0 || creditNote.grandTotal.lte(0) ? (
                  <p className="notice error">Add at least one positive credit line before issuing.</p>
                ) : null}
                {workspace.series.length > 0 ? (
                  <form className="form" action="/api/credit-notes/issue" method="post">
                    <input type="hidden" name="creditNoteId" value={creditNote.id} />
                    <div className="field">
                      <label htmlFor="seriesId">Number series</label>
                      <select id="seriesId" name="seriesId" required>
                        {workspace.series.map((series) => (
                          <option key={series.id} value={series.id}>
                            {series.name} - next {previewCreditNoteNumber(series, creditNote.creditNoteDate, workspace.organisation.financialYearStart)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="button" type="submit" disabled={!canIssue}>
                      <Send size={18} />
                      Issue credit note
                    </button>
                  </form>
                ) : null}
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Output</p>
                  <h2>Documents</h2>
                </div>
                <FileText size={20} />
              </div>
              <a className="button" href={`/api/credit-notes/${creditNote.id}/pdf`} target="_blank" rel="noreferrer">
                <FileText size={18} />
                Open PDF
              </a>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function snapshotText(snapshot: unknown, group: string, key: string): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "";
  const record = snapshot as Record<string, unknown>;
  const groupRecord = record[group];
  if (!groupRecord || typeof groupRecord !== "object" || Array.isArray(groupRecord)) return "";
  const value = (groupRecord as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function previewCreditNoteNumber(
  series: {
    pattern: string;
    prefix: string | null;
    nextSequence: number;
    startingNumber: number;
    resetRule: "never" | "calendar_year" | "financial_year";
    lastResetKey: string | null;
  },
  date: Date,
  financialYearStartMonth: number
) {
  const resetKey = resetKeyForRule(series.resetRule, date, financialYearStartMonth);
  const sequence = resetKey !== null && series.lastResetKey !== resetKey
    ? series.startingNumber
    : series.nextSequence;

  return renderInvoiceNumber({
    pattern: series.pattern,
    prefix: series.prefix,
    sequence,
    date,
    financialYearStartMonth
  });
}
