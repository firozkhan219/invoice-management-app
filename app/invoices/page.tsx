import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FilePlus2, Search, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { draftIssueRequirements, draftLifecycleLabel } from "@/lib/invoices/lifecycle";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoiceIssueOptions, listInvoices } from "@/lib/invoices/invoice-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; currency?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");
  const filters = await searchParams;
  const invoices = await listInvoices(context, filters);
  const issueOptions = await getInvoiceIssueOptions(context);
  const query = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const csvHref = `/api/reports/invoice-register${query.size ? `?${query.toString()}` : ""}`;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Transactions</p>
          <h1>Invoices</h1>
        </div>
        <div className="toolbar">
          <a className="button subtle" href={csvHref}>
            <Download size={18} />
            Export CSV
          </a>
          <Link className="button" href="/invoices/new">
            <FilePlus2 size={18} />
            New draft
          </Link>
        </div>
      </header>
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="muted">Search and filter</p>
            <h2>Invoice register</h2>
          </div>
          <Search size={20} />
        </div>
        <form className="form" method="get">
          <div className="form-grid three">
            <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={filters?.q || ""} /></div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={filters?.status || ""}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="field"><label htmlFor="currency">Currency</label><input id="currency" name="currency" maxLength={3} defaultValue={filters?.currency || ""} /></div>
            <div className="field"><label htmlFor="dateFrom">From</label><input id="dateFrom" name="dateFrom" type="date" defaultValue={filters?.dateFrom || ""} /></div>
            <div className="field"><label htmlFor="dateTo">To</label><input id="dateTo" name="dateTo" type="date" defaultValue={filters?.dateTo || ""} /></div>
          </div>
          <div className="toolbar">
            <button className="button" type="submit">
              <Search size={18} />
              Apply filters
            </button>
          </div>
        </form>
      </section>

      <section className="panel top-space">
        <div className="section-title">
          <div>
            <p className="muted">Results</p>
            <h2>{invoices.length} invoices</h2>
          </div>
        </div>
        {invoices.length === 0 ? (
          <div className="empty-state">No invoices found. Create a draft or adjust the filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Number</th><th>Buyer</th><th>Status</th><th>Lifecycle</th><th>Total</th><th>Paid</th><th>Balance</th><th>Action</th></tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const issueRequirements = draftIssueRequirements({
                    status: invoice.status,
                    companyId: invoice.companyId,
                    buyerId: invoice.buyerId,
                    itemCount: invoice.items.length,
                    grandTotal: invoice.grandTotal
                  });
                  const lifecycleLabel = draftLifecycleLabel({
                    status: invoice.status,
                    companyId: invoice.companyId,
                    buyerId: invoice.buyerId,
                    itemCount: invoice.items.length,
                    grandTotal: invoice.grandTotal
                  });
                  const canIssue = invoice.status === "draft"
                    && issueRequirements.length === 0
                    && issueOptions.series.length > 0;
                  const canDeleteEmptyDraft = invoice.status === "draft" && invoice.items.length === 0;

                  return (
                    <tr key={invoice.id}>
                      <td><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceDate.toISOString().slice(0, 10)}</Link></td>
                      <td>{invoice.invoiceNumber || "-"}</td>
                      <td>{invoice.buyer?.displayName || "-"}</td>
                      <td><span className={`status-badge ${invoice.status}`}>{invoice.status.replace("_", " ")}</span></td>
                      <td><span className={lifecycleLabel === "Ready to issue" ? "badge" : "badge neutral"}>{lifecycleLabel}</span></td>
                      <td>{invoice.currency} {invoice.grandTotal.toString()}</td>
                      <td>{invoice.currency} {invoice.paidTotal.toString()}</td>
                      <td>{invoice.currency} {invoice.balanceDue.toString()}</td>
                      <td>
                        {canIssue ? (
                          <form className="inline-action" action="/api/invoices/issue" method="post">
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="expectedVersion" value={invoice.version} />
                            <select aria-label="Number series" name="seriesId" defaultValue={issueOptions.series[0]?.id} required>
                              {issueOptions.series.map((series) => (
                                <option key={series.id} value={series.id}>
                                  {previewInvoiceNumber(series, invoice.invoiceDate, issueOptions.organisation.financialYearStart)}
                                </option>
                              ))}
                            </select>
                            <button className="button" type="submit">
                              <Send size={16} />
                              Issue
                            </button>
                          </form>
                        ) : (
                          <div className="inline-action">
                            <Link className="button subtle" href={`/invoices/${invoice.id}`}>Open</Link>
                            {canDeleteEmptyDraft ? (
                              <form action="/api/invoices/delete" method="post">
                                <input type="hidden" name="invoiceId" value={invoice.id} />
                                <button className="button danger" type="submit">
                                  <Trash2 size={16} />
                                  Delete
                                </button>
                              </form>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
