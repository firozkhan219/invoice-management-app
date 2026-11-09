import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, CreditCard, FileClock, FileText, PackageCheck, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoice, getInvoiceEditorData, getInvoiceIssueOptions } from "@/lib/invoices/invoice-service";
import { draftIssueRequirements } from "@/lib/invoices/lifecycle";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";
import { DraftFields, isoDate } from "../draft-fields";

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
  await searchParams;
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
      <header className="page-header">
        <div>
          <p className="muted">Invoice workspace</p>
          <h1>{invoice.invoiceNumber || "Unnumbered draft"}</h1>
          <div className="meta-row">
            <span className={`status-badge ${invoice.status}`}>{statusLabel}</span>
            <span>Version {invoice.version}</span>
            <span>{invoice.invoiceDate.toISOString().slice(0, 10)}</span>
          </div>
        </div>
        <div className="toolbar">
          <Link className="button subtle" href="/invoices">Invoices</Link>
          {canOpenPdf ? (
            <a className="button" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <FileText size={18} />
              Open PDF
            </a>
          ) : null}
          {canRecordPayment ? (
            <Link className="button subtle" href={paymentHref}>
              <CreditCard size={18} />
              Record payment
            </Link>
          ) : null}
        </div>
      </header>

      <div className="summary-grid">
        <div className="stat">
          <span className="muted">Grand total</span>
          <strong>{invoice.currency} {invoice.grandTotal.toString()}</strong>
        </div>
        <div className="stat">
          <span className="muted">Paid</span>
          <strong>{invoice.currency} {invoice.paidTotal.toString()}</strong>
        </div>
        {invoice.creditedTotal.gt(0) ? (
          <div className="stat">
            <span className="muted">Credited</span>
            <strong>{invoice.currency} {invoice.creditedTotal.toString()}</strong>
          </div>
        ) : null}
        <div className="stat">
          <span className="muted">Balance</span>
          <strong>{invoice.currency} {invoice.balanceDue.toString()}</strong>
        </div>
      </div>

      <section className="document-command-panel">
        <div>
          <p className="muted">{isDraft ? "Before issuing" : "Invoice status"}</p>
          <h2>{readiness.ready === readiness.total ? (isDraft ? "Ready to issue" : "All details complete") : `${readiness.ready} of ${readiness.total} details complete`}</h2>
        </div>
        <div className="readiness-list">
          {readiness.items.map((item) => (
            <span className={item.done ? "ready-check done" : "ready-check"} key={item.label}>
              {item.done ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {item.label}
            </span>
          ))}
        </div>
        <div className="document-link-grid">
          {canOpenPdf ? (
            <a className="document-link-card primary" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <FileText size={18} />
              <span><strong>Invoice PDF</strong><small>Commercial invoice output</small></span>
            </a>
          ) : (
            <span className="document-link-card disabled">
              <FileText size={18} />
              <span><strong>Invoice PDF</strong><small>Available after issue</small></span>
            </span>
          )}
          {issuedPackingLists.length > 0 ? issuedPackingLists.map((packingList) => (
            <a className="document-link-card" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer" key={packingList.id}>
              <PackageCheck size={18} />
              <span><strong>Packing List</strong><small>{packingList.packingListNumber || "Issued document"}</small></span>
            </a>
          )) : canCreatePackingList ? (
            <Link className="document-link-card" href={`/packing-lists/new?invoiceId=${invoice.id}`}>
              <PackageCheck size={18} />
              <span><strong>Create Packing List</strong><small>Copy from this invoice</small></span>
            </Link>
          ) : null}
          {issuedCreditNotes.map((creditNote) => (
            <a className="document-link-card" href={`/api/credit-notes/${creditNote.id}/pdf`} target="_blank" rel="noreferrer" key={creditNote.id}>
              <Undo2 size={18} />
              <span><strong>Credit Note</strong><small>{creditNote.creditNoteNumber || "Issued correction"}</small></span>
            </a>
          ))}
        </div>
      </section>

      <div className="grid two-column">
        <div className="grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Snapshot</p>
                <h2>Invoice overview</h2>
              </div>
            </div>
            <table className="table compact">
            <tbody>
              <tr><th>Buyer</th><td>{invoice.buyer?.displayName || "-"}</td></tr>
              <tr><th>Company</th><td>{invoice.company?.legalName || "-"}</td></tr>
              <tr><th>Bank account</th><td>{invoice.bankAccount ? `${invoice.bankAccount.bankName} - ${invoice.bankAccount.accountNumberLast4}` : "-"}</td></tr>
              <tr><th>Due date</th><td>{invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "-"}</td></tr>
              <tr><th>Buyer order</th><td>{invoice.buyerOrderNumber || "-"}</td></tr>
              <tr><th>Exporter reference</th><td>{invoice.exporterReference || "-"}</td></tr>
              <tr><th>Tax mode</th><td>{invoice.taxMode.replace("_", " ")}{invoice.cgstTotal.gt(0) ? " → CGST + SGST" : invoice.igstTotal.gt(0) ? " → IGST" : ""}</td></tr>
              <tr><th>Place of supply</th><td>{invoice.placeOfSupplyStateCode || invoice.shippingAddress?.stateCode || invoice.billingAddress?.stateCode || "-"}</td></tr>
              <tr><th>Invoice discount</th><td>{invoice.invoiceDiscount.toString()}</td></tr>
              <tr><th>Other charges</th><td>{invoice.otherCharges.toString()}</td></tr>
              <tr><th>Subtotal</th><td>{invoice.subtotal.toString()}</td></tr>
              <tr><th>IGST</th><td>{invoice.igstTotal.toString()}</td></tr>
              <tr><th>CGST</th><td>{invoice.cgstTotal.toString()}</td></tr>
              <tr><th>SGST</th><td>{invoice.sgstTotal.toString()}</td></tr>
              <tr><th>Round off</th><td>{invoice.roundOff.toString()}</td></tr>
              <tr><th>Grand total</th><td>{invoice.currency} {invoice.grandTotal.toString()}</td></tr>
              <tr><th>Paid total</th><td>{invoice.currency} {invoice.paidTotal.toString()}</td></tr>
              <tr><th>Balance due</th><td>{invoice.currency} {invoice.balanceDue.toString()}</td></tr>
            </tbody>
            </table>
          </section>

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
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>HSN/SAC</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>GST</th>
                    <th>Total</th>
                    {isDraft && mayCreate ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sortOrder}</td>
                      <td>{item.description}</td>
                      <td>{item.hsnSac || "-"}</td>
                      <td>{item.quantity.toString()} {item.unitCode || ""}</td>
                      <td>{item.rate.toString()}</td>
                      <td>{item.gstRate.toString()}%</td>
                      <td>{item.lineTotal.toString()}</td>
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
            )}
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
                        <td>{creditNote.currency} {creditNote.grandTotal.toString()}</td>
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
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Finalise</p>
                  <h2>Issue invoice</h2>
                </div>
                <Send size={20} />
              </div>
              {issueRequirements.length > 0 ? (
                <p className="notice error">Before issuing: {issueRequirements.join(", ")}.</p>
              ) : null}
              {seriesList.length === 0 ? (
                <p className="muted">Create an invoice number series in Settings first.</p>
              ) : (
                <form className="form" action="/api/invoices/issue" method="post">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="expectedVersion" value={invoice.version} />
                  <div className="field">
                    <label htmlFor="seriesId">Number series</label>
                    <select id="seriesId" name="seriesId" required>
                      {seriesList.map((series) => (
                        <option key={series.id} value={series.id}>
                          {series.name} - next {previewInvoiceNumber(series, invoice.invoiceDate, issueOptions!.organisation.financialYearStart)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="button" type="submit" disabled={!canIssue}>
                    <Send size={18} />
                    Issue invoice
                  </button>
                </form>
              )}
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

          {isDraft && editorData ? (
          <>
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
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Draft details</p>
                <h2>Update invoice</h2>
              </div>
              <Save size={20} />
            </div>
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
              <button className="button" type="submit">
                <Save size={18} />
                Save draft
              </button>
            </form>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Invoice rows</p>
                <h2>Add line item</h2>
              </div>
              <Plus size={20} />
            </div>
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
              <button className="button" type="submit">
                <Plus size={18} />
                Add line
              </button>
            </form>
          </section>
          </>
          ) : isDraft ? null : (
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Locked</p>
                  <h2>Draft editing closed</h2>
                </div>
              </div>
              <p className="muted">This invoice has been issued, so changes must be handled through payments, credit notes, cancellation, or a new invoice.</p>
            </section>
          )}
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
