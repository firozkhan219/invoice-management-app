import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Copy, CreditCard, Eye, FileClock, FileText, PackageCheck, Pencil, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { daysOverdue, getInvoice, getInvoiceEditorData, getInvoiceIssueOptions } from "@/lib/invoices/invoice-service";
import { draftIssueRequirements } from "@/lib/invoices/lifecycle";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";
import { DraftFields, isoDate } from "../draft-fields";
import { formatMoney, formatAmount, formatQuantity } from "@/lib/format";
import { IssueNumberFields } from "./issue-number-fields";

export default async function InvoiceEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  const { id } = await params;
  const invoice = await getInvoice(context, id);
  if (!invoice) redirect("/invoices");
  const query = await searchParams;
  const mayCreate = hasPermission(context.role, "invoices:create");
  const mayIssue = hasPermission(context.role, "invoices:issue");
  const mayCancel = hasPermission(context.role, "invoices:cancel");
  const mayManagePayments = hasPermission(context.role, "payments:manage");
  const isDraft = invoice.status === "draft";
  const editorData = isDraft && mayCreate ? await getInvoiceEditorData(context) : null;
  const issueOptions = isDraft && mayIssue ? await getInvoiceIssueOptions(context) : null;
  const seriesList = issueOptions?.series ?? [];
  const canOpenPdf = ["issued", "partially_paid", "paid"].includes(invoice.status);
  const canRecordPayment = mayManagePayments && ["issued", "partially_paid"].includes(invoice.status) && invoice.balanceDue.gt(0);
  const canCreateCreditNote = mayCreate && ["issued", "partially_paid", "paid"].includes(invoice.status);
  const canCreatePackingList = canCreateCreditNote;
  const issuedPackingLists = invoice.packingLists.filter((packingList) => packingList.status === "issued");
  const draftPackingLists = invoice.packingLists.filter((packingList) => packingList.status === "draft");
  const issuedCreditNotes = invoice.creditNotes.filter((creditNote) => creditNote.status === "issued");
  const canCancel = mayCancel && invoice.status === "issued" && invoice.paidTotal.lte(0) && invoice.creditedTotal.lte(0);
  const canIssue = Boolean(mayIssue && invoice.companyId && invoice.buyerId && invoice.items.length > 0 && invoice.grandTotal.gt(0) && seriesList.length > 0);
  const paymentHref = `/payments?invoiceId=${invoice.id}`;
  const canReopen = mayCreate && mayIssue && invoice.status === "issued" && invoice.paidTotal.lte(0) && invoice.creditedTotal.lte(0) && issuedCreditNotes.length === 0;
  const editOpen = query?.edit === "1";
  const statusLabel = invoice.status.replace("_", " ");
  const readiness = invoiceReadiness({
    hasCompany: Boolean(invoice.companyId),
    hasBuyer: Boolean(invoice.buyerId),
    hasItems: invoice.items.length > 0,
    hasPositiveTotal: invoice.grandTotal.gt(0),
    hasSeries: Boolean(invoice.invoiceNumber) || seriesList.length > 0,
    // Shipping fields only matter for export invoices (foreign currency or zero-rated export).
    isExport: invoice.currency !== "INR" || invoice.taxMode === "zero_rated_export",
    hasExportFields: Boolean(invoice.portOfLoading && invoice.portOfDischarge && invoice.finalDestination)
  });
  const issueRequirements = [
    ...draftIssueRequirements({
      status: invoice.status,
      companyId: invoice.companyId,
      buyerId: invoice.buyerId,
      itemCount: invoice.items.length,
      grandTotal: invoice.grandTotal
    }),
    mayIssue && seriesList.length === 0 ? "create an invoice number series" : null
  ].filter((requirement): requirement is string => Boolean(requirement));

  return (
    <AppShell>
      <header className="invoice-head">
        <div className="invoice-head-title">
          <Link className="back-link" href="/invoices"><ArrowLeft size={15} /> Invoices</Link>
          <h1>
            {invoice.invoiceNumber || "Draft invoice"}
            <span className={`status-badge ${invoice.status}`}>{statusLabel}</span>
            {daysOverdue(invoice) > 0 ? <span className="status-badge overdue">{daysOverdue(invoice)} days overdue</span> : null}
          </h1>
          <p className="muted">
            {invoice.buyer?.displayName || "No buyer yet"} · {formatDate(invoice.invoiceDate)} · {formatMoney(invoice.currency, invoice.grandTotal)}
          </p>
        </div>
        <div className="toolbar">
          {isDraft && editorData ? (
            <Link className="button subtle" href={`/invoices/${invoice.id}?edit=1#edit-invoice`}><Pencil size={16} /> Edit invoice</Link>
          ) : null}
          {canReopen ? (
            <form action="/api/invoices/reopen" method="post">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="button subtle" type="submit"><Pencil size={16} /> Edit invoice</button>
            </form>
          ) : null}
          {canOpenPdf ? (
            <a className="button subtle" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer"><FileText size={16} /> PDF</a>
          ) : null}
          {isDraft ? (
            <a className="button subtle" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer"><Eye size={16} /> Preview PDF</a>
          ) : null}
          {mayCreate ? (
            <form action="/api/invoices/duplicate" method="post">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <button className="button subtle" type="submit" title="Copy this invoice into a new draft"><Copy size={16} /> Duplicate</button>
            </form>
          ) : null}
          {canRecordPayment ? (
            <Link className="button subtle" href={paymentHref}><CreditCard size={16} /> Record payment</Link>
          ) : null}
          {isDraft && mayIssue && (seriesList.length > 0 || invoice.invoiceNumber) ? (
            <a className="button" href="#issue-invoice"><Send size={16} /> {invoice.invoiceNumber ? "Re-issue" : "Issue"}</a>
          ) : null}
        </div>
      </header>

      {isDraft && readiness.ready < readiness.total ? (
        <div className="readiness-strip">
          <strong>{readiness.ready} of {readiness.total} ready</strong>
          {readiness.items.map((item) => (
            <span className={item.done ? "ready-check done" : "ready-check"} key={item.label}>
              {item.done ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {isDraft && invoice.invoiceNumber ? (
        <p className="notice">This invoice is open for editing. It keeps number {invoice.invoiceNumber}; issue it again to update the PDF.</p>
      ) : null}
      {isDraft && invoice.items.length > 0 ? (
        <details className="details document-preview">
          <summary><Eye size={16} /> Draft preview (save changes first to see them here)</summary>
          <iframe
            className="pdf-preview-frame"
            src={`/api/invoices/${invoice.id}/pdf?v=${invoice.version}#view=FitH`}
            title="Invoice PDF preview"
            loading="lazy"
          />
        </details>
      ) : null}

      <div className="grid two-column document-layout">
        <div className="grid">
          <section className="panel invoice-summary">
            <dl className="detail-grid">
              <DetailItem label="Bill to" value={invoice.buyer?.displayName} />
              <DetailItem label="Company" value={invoice.company?.legalName} />
              <DetailItem label="Invoice date" value={formatDate(invoice.invoiceDate)} />
              <DetailItem label="Due date" value={invoice.dueDate ? formatDate(invoice.dueDate) : null} />
              <DetailItem label="Bank" value={invoice.bankAccount ? `${invoice.bankAccount.bankName} ··${invoice.bankAccount.accountNumberLast4}` : null} />
              <DetailItem label="Tax" value={`${taxLabel(invoice.taxMode)}${invoice.taxMode === "automatic" ? (invoice.cgstTotal.gt(0) ? " (CGST + SGST)" : invoice.igstTotal.gt(0) ? " (IGST)" : "") : ""}`} />
              <DetailItem label="Place of supply" value={invoice.placeOfSupplyStateCode || invoice.shippingAddress?.stateCode || invoice.billingAddress?.stateCode} />
              <DetailItem label="Currency" value={invoice.currency} />
              {invoice.buyerOrderNumber ? <DetailItem label="Buyer order" value={invoice.buyerOrderNumber} /> : null}
              {invoice.exporterReference ? <DetailItem label="Exporter ref." value={invoice.exporterReference} /> : null}
              {invoice.portOfLoading ? <DetailItem label="Port of loading" value={invoice.portOfLoading} /> : null}
              {invoice.portOfDischarge ? <DetailItem label="Port of discharge" value={invoice.portOfDischarge} /> : null}
              {invoice.finalDestination ? <DetailItem label="Destination" value={invoice.finalDestination} /> : null}
            </dl>
            <table className="totals-box">
              <tbody>
                <tr><th>Subtotal</th><td>{formatAmount(invoice.subtotal)}</td></tr>
                {/* Only adjustments and taxes that actually apply. */}
                {invoice.invoiceDiscount.isZero() ? null : <tr><th>Discount</th><td>- {formatAmount(invoice.invoiceDiscount)}</td></tr>}
                {invoice.otherCharges.isZero() ? null : <tr><th>Other charges</th><td>{formatAmount(invoice.otherCharges)}</td></tr>}
                {invoice.igstTotal.isZero() ? null : <tr><th>IGST</th><td>{formatAmount(invoice.igstTotal)}</td></tr>}
                {invoice.cgstTotal.isZero() ? null : <tr><th>CGST</th><td>{formatAmount(invoice.cgstTotal)}</td></tr>}
                {invoice.sgstTotal.isZero() ? null : <tr><th>SGST</th><td>{formatAmount(invoice.sgstTotal)}</td></tr>}
                {invoice.roundOff.isZero() ? null : <tr><th>Round off</th><td>{formatAmount(invoice.roundOff)}</td></tr>}
                <tr className="grand"><th>Total</th><td>{formatMoney(invoice.currency, invoice.grandTotal)}</td></tr>
                {isDraft ? null : <tr><th>Paid</th><td>{formatMoney(invoice.currency, invoice.paidTotal)}</td></tr>}
                {invoice.creditedTotal.gt(0) ? <tr><th>Credited</th><td>{formatMoney(invoice.currency, invoice.creditedTotal)}</td></tr> : null}
                {isDraft ? null : <tr className="balance"><th>Balance due</th><td>{formatMoney(invoice.currency, invoice.balanceDue)}</td></tr>}
              </tbody>
            </table>
          </section>

          {isDraft && editorData ? (
            <details className="panel edit-panel" id="edit-invoice" open={editOpen}>
              <summary><Pencil size={16} /> <strong>Edit invoice details</strong><span className="muted">Buyer, dates, addresses, shipping and notes</span></summary>
              <form className="form" action="/api/invoices" method="post">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="version" value={invoice.version} />
              <DraftFields
                  editor={editorData}
                  values={{
                    companyId: invoice.companyId,
                    buyerId: invoice.buyerId,
                    consigneeBuyerId: invoice.consigneeBuyerId,
                    billingAddressId: invoice.billingAddressId,
                    shippingAddressId: invoice.shippingAddressId,
                    bankAccountId: invoice.bankAccountId,
                    invoiceDate: isoDate(invoice.invoiceDate),
                    dueDate: isoDate(invoice.dueDate),
                    currency: invoice.currency,
                    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
                    taxMode: invoice.taxMode,
                    buyerOrderNumber: invoice.buyerOrderNumber,
                    buyerOrderDate: isoDate(invoice.buyerOrderDate),
                    exporterReference: invoice.exporterReference,
                    preCarriageBy: invoice.preCarriageBy,
                    placeOfReceipt: invoice.placeOfReceipt,
                    vesselFlightNo: invoice.vesselFlightNo,
                    portOfLoading: invoice.portOfLoading,
                    portOfDischarge: invoice.portOfDischarge,
                    finalDestination: invoice.finalDestination,
                    termsOfDelivery: invoice.termsOfDelivery,
                    notes: invoice.notes,
                    declaration: invoice.declaration,
                    invoiceDiscount: invoice.invoiceDiscount.toString(),
                    otherCharges: invoice.otherCharges.toString()
                  }}
                />
                <div className="toolbar start">
                  <button className="button" type="submit"><Save size={16} /> Save changes</button>
                  <Link className="button subtle" href={`/invoices/${invoice.id}`}>Close</Link>
                </div>
              </form>
            </details>
          ) : null}

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Goods and services</p>
                <h2>Line items</h2>
              </div>
              <span className="badge">{invoice.items.length} lines</span>
            </div>
            {invoice.items.length === 0 ? (
              <p className="muted">No line items yet.</p>
            ) : (
              <div className="table-wrap">
              <table className="table line-items">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="description">Description</th>
                    <th>HSN/SAC</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">GST</th>
                    <th className="num">Amount</th>
                    {isDraft && mayCreate ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sortOrder}</td>
                      <td className="description">{item.description}</td>
                      <td>{item.hsnSac || "-"}</td>
                      <td className="num">{formatQuantity(item.quantity)} {item.unitCode || ""}</td>
                      <td className="num">{formatAmount(item.rate)}</td>
                      <td className="num">{item.gstRate.toString()}%</td>
                      <td className="num strong">{formatAmount(item.lineTotal)}</td>
                      {isDraft && mayCreate ? (
                        <td>
                          <div className="line-actions">
                            <details className="details compact">
                              <summary>Edit</summary>
                              <form className="form compact-form" action="/api/invoices/items/update" method="post">
                                <input type="hidden" name="invoiceId" value={invoice.id} />
                                <input type="hidden" name="lineItemId" value={item.id} />
                                <input type="hidden" name="expectedVersion" value={invoice.version} />
                                <input type="hidden" name="sortOrder" value={item.sortOrder} />
                                <input type="hidden" name="itemId" value={item.itemId || ""} />
                                <input type="hidden" name="sku" value={item.sku || ""} />
                                <div className="field">
                                  <label htmlFor={`description-${item.id}`}>Description</label>
                                  <textarea id={`description-${item.id}`} name="description" defaultValue={item.description} required />
                                </div>
                                <div className="field">
                                  <label htmlFor={`hsn-${item.id}`}>HSN/SAC</label>
                                  <input id={`hsn-${item.id}`} name="hsnSac" defaultValue={item.hsnSac || ""} maxLength={20} />
                                </div>
                                <div className="form-grid">
                                  <div className="field">
                                    <label htmlFor={`quantity-${item.id}`}>Qty</label>
                                    <input id={`quantity-${item.id}`} name="quantity" type="number" step="0.0001" min="0.0001" defaultValue={item.quantity.toString()} required />
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`unit-${item.id}`}>Unit</label>
                                    <input id={`unit-${item.id}`} name="unitCode" defaultValue={item.unitCode || ""} />
                                  </div>
                                </div>
                                <div className="form-grid">
                                  <div className="field">
                                    <label htmlFor={`rate-${item.id}`}>Rate</label>
                                    <input id={`rate-${item.id}`} name="rate" type="number" step="0.0001" min="0" defaultValue={item.rate.toString()} required />
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`gst-${item.id}`}>GST %</label>
                                    <input id={`gst-${item.id}`} name="gstRate" type="number" step="0.0001" min="0" max="100" defaultValue={item.gstRate.toString()} />
                                  </div>
                                </div>
                                <div className="field">
                                  <label htmlFor={`discount-${item.id}`}>Discount</label>
                                  <input id={`discount-${item.id}`} name="discountAmount" type="number" step="0.01" min="0" defaultValue={item.discountAmount.toString()} />
                                </div>
                                <button className="button" type="submit">
                                  <Save size={18} />
                                  Save line
                                </button>
                              </form>
                            </details>
                            <form action="/api/invoices/items/delete" method="post">
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <input type="hidden" name="lineItemId" value={item.id} />
                              <input type="hidden" name="expectedVersion" value={invoice.version} />
                              <button className="inline-action danger" type="submit">
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {isDraft && editorData ? (
              <details className="add-line" open={invoice.items.length === 0}>
                <summary><Plus size={16} /> Add line item</summary>
                <form className="form" action="/api/invoices/items" method="post">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="expectedVersion" value={invoice.version} />
              <div className="field">
                    <label htmlFor="itemId">Catalog item</label>
                    <select id="itemId" name="itemId" defaultValue="">
                      <option value="">Manual line</option>
                      {editorData.masterItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.saleRate ? ` - ${item.currency} ${item.saleRate.toString()}` : ""}{item.hsnSac ? ` - HSN ${item.hsnSac}` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="muted">With a catalog item, blank description, HSN, unit, rate and GST are filled from the item.</p>
                  </div>
                  <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" /></div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="hsnSac">HSN/SAC</label><input id="hsnSac" name="hsnSac" maxLength={20} /></div>
                    <div className="field"><label htmlFor="unitCode">Unit</label><input id="unitCode" name="unitCode" /></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" step="0.0001" min="0.0001" required /></div>
                    <div className="field"><label htmlFor="rate">Rate</label><input id="rate" name="rate" type="number" step="0.0001" min="0" /></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="gstRate">GST %</label><input id="gstRate" name="gstRate" type="number" step="0.0001" min="0" max="100" /></div>
                    <div className="field"><label htmlFor="discountAmount">Line discount</label><input id="discountAmount" name="discountAmount" type="number" step="0.01" min="0" defaultValue="0" /></div>
                  </div>
                  <button className="button" type="submit"><Plus size={16} /> Add line</button>
                </form>
              </details>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Immutable history</p>
                <h2>Revision history</h2>
              </div>
              <FileClock size={20} />
            </div>
            {invoice.revisions.length === 0 ? (
              <p className="muted">No issued snapshot has been recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Revision</th><th>Reason</th><th>Created</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {invoice.revisions.map((revision) => (
                      <tr key={revision.id}>
                        <td>v{revision.revisionNumber}</td>
                        <td>{revision.reason}</td>
                        <td>{revision.createdAt.toISOString().slice(0, 10)}</td>
                        <td>{revision.createdBy.name || revision.createdBy.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Corrections</p>
                <h2>Credit notes</h2>
              </div>
              <Undo2 size={20} />
            </div>
            {invoice.creditNotes.length === 0 ? (
              <p className="muted">No credit notes have been drafted for this invoice.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Number</th><th>Status</th><th>Total</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {invoice.creditNotes.map((creditNote) => (
                      <tr key={creditNote.id}>
                        <td>{creditNote.creditNoteDate.toISOString().slice(0, 10)}</td>
                        <td>{creditNote.creditNoteNumber || "Draft"}</td>
                        <td><span className={`status-badge ${creditNote.status}`}>{creditNote.status}</span></td>
                        <td>{formatMoney(creditNote.currency, creditNote.grandTotal)}</td>
                        <td>{creditNote.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="grid">
          {canCreateCreditNote ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Correction draft</p>
                  <h2>Create credit note</h2>
                </div>
                <Undo2 size={20} />
              </div>
              <form className="form" action="/api/credit-notes" method="post">
                <input type="hidden" name="originalInvoiceId" value={invoice.id} />
                <div className="field">
                  <label htmlFor="credit-note-reason">Reason</label>
                  <textarea id="credit-note-reason" name="reason" placeholder="Short correction reason" />
                </div>
                <button className="button" type="submit">
                  <Undo2 size={18} />
                  Create draft
                </button>
              </form>
            </section>
          ) : null}

          {isDraft && mayIssue ? (
            <section className="panel" id="issue-invoice">
              <div className="section-title">
                <div>
                  <p className="muted">Finalise</p>
                  <h2>{invoice.invoiceNumber ? "Re-issue invoice" : "Issue invoice"}</h2>
                </div>
                <Send size={20} />
              </div>
              {issueRequirements.length > 0 ? (
                <p className="notice error">Before issuing: {issueRequirements.join(", ")}.</p>
              ) : null}
              {seriesList.length === 0 && !invoice.invoiceNumber ? (
                <p className="muted">Create an invoice number series in <Link href="/settings">Settings</Link> first.</p>
              ) : (
                <form className="form" action="/api/invoices/issue" method="post">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="expectedVersion" value={invoice.version} />
                  <IssueNumberFields
                    currentNumber={invoice.invoiceNumber}
                    series={seriesList.map((series) => ({
                      id: series.id,
                      name: series.name,
                      preview: previewInvoiceNumber(series, invoice.invoiceDate, issueOptions!.organisation.financialYearStart)
                    }))}
                  />
                  <button className="button" type="submit" disabled={!canIssue}>
                    <Send size={18} />
                    {invoice.invoiceNumber ? "Re-issue invoice" : "Issue invoice"}
                  </button>
                </form>
              )}
            </section>
          ) : null}

          {!isDraft && !canReopen && mayCreate && invoice.status !== "cancelled" ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Editing</p>
                  <h2>Locked for editing</h2>
                </div>
              </div>
              <p className="muted">This invoice has payments or credit notes, so it can&apos;t be edited directly. Correct it with a credit note{invoice.paidTotal.gt(0) ? ", or reverse the payments first" : ""}.</p>
            </section>
          ) : null}

          {canOpenPdf ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Export output</p>
                  <h2>Documents</h2>
                </div>
                <FileText size={20} />
              </div>
              <div className="action-stack">
                <a className="button" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <FileText size={18} />
                  Invoice PDF
                </a>
                {issuedPackingLists.map((packingList) => (
                  <a key={packingList.id} className="button subtle" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer">
                    <PackageCheck size={18} />
                    Packing list {packingList.packingListNumber || ""}
                  </a>
                ))}
                {mayCreate ? draftPackingLists.map((packingList) => (
                  <Link key={packingList.id} className="button subtle" href={`/packing-lists/${packingList.id}`}>
                    <PackageCheck size={18} />
                    Continue packing draft
                  </Link>
                )) : null}
                {issuedCreditNotes.map((creditNote) => (
                  <a key={creditNote.id} className="button subtle" href={`/api/credit-notes/${creditNote.id}/pdf`} target="_blank" rel="noreferrer">
                    <Undo2 size={18} />
                    Credit note {creditNote.creditNoteNumber || ""}
                  </a>
                ))}
                {canCreatePackingList ? (
                  <Link className="button subtle" href={`/packing-lists/new?invoiceId=${invoice.id}`}>
                    <PackageCheck size={18} />
                    Create packing list
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {canRecordPayment ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Payment</p>
                  <h2>Receivable</h2>
                </div>
                <CreditCard size={20} />
              </div>
              <Link className="button subtle" href={paymentHref}>
                <CreditCard size={18} />
                Record payment
              </Link>
            </section>
          ) : null}

          {canCancel ? (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Control</p>
                  <h2>Cancel invoice</h2>
                </div>
                <Ban size={20} />
              </div>
              <form className="form" action="/api/invoices/cancel" method="post">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <div className="field">
                  <label htmlFor="reason">Reason</label>
                  <textarea id="reason" name="reason" required />
                </div>
                <button className="button" type="submit">
                  <Ban size={18} />
                  Cancel invoice
                </button>
              </form>
            </section>
          ) : null}

          {isDraft && editorData && !invoice.invoiceNumber ? (
          <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Draft control</p>
                  <h2>Delete draft</h2>
                </div>
                <Trash2 size={20} />
              </div>
              <form className="form" action="/api/invoices/delete" method="post">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <label className="checkbox">
                  <input type="checkbox" name="confirm" required /> Permanently delete this draft
                </label>
                <button className="button danger" type="submit">
                  <Trash2 size={18} />
                  Delete draft
                </button>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}

function previewInvoiceNumber(
  series: {
    pattern: string;
    prefix: string | null;
    nextSequence: number;
    startingNumber: number;
    resetRule: "never" | "calendar_year" | "financial_year";
    lastResetKey: string | null;
  },
  invoiceDate: Date,
  financialYearStartMonth: number
) {
  const resetKey = resetKeyForRule(series.resetRule, invoiceDate, financialYearStartMonth);
  const sequence = resetKey !== null && series.lastResetKey !== resetKey
    ? series.startingNumber
    : series.nextSequence;

  return renderInvoiceNumber({
    pattern: series.pattern,
    prefix: series.prefix,
    sequence,
    date: invoiceDate,
    financialYearStartMonth
  });
}

function invoiceReadiness(input: {
  hasCompany: boolean;
  hasBuyer: boolean;
  hasItems: boolean;
  hasPositiveTotal: boolean;
  hasSeries: boolean;
  isExport: boolean;
  hasExportFields: boolean;
}) {
  const items = [
    { label: "Company", done: input.hasCompany },
    { label: "Buyer", done: input.hasBuyer },
    { label: "Line items", done: input.hasItems },
    { label: "Amount", done: input.hasPositiveTotal },
    { label: "Invoice number", done: input.hasSeries },
    ...(input.isExport ? [{ label: "Shipping details", done: input.hasExportFields }] : [])
  ];

  return {
    items,
    ready: items.filter((item) => item.done).length,
    total: items.length
  };
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function taxLabel(taxMode: string) {
  const labels: Record<string, string> = {
    automatic: "Automatic GST",
    igst: "IGST",
    cgst_sgst: "CGST + SGST",
    zero_rated_export: "Zero-rated export",
    no_tax: "No tax"
  };
  return labels[taxMode] || taxMode.replace(/_/g, " ");
}
