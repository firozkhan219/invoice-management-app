import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSummary } from "@/lib/dashboard/dashboard-service";
import { permissionsForRole } from "@/lib/permissions/roles";
import { AppShell } from "@/components/app-shell";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const membership = user.memberships[0];

  if (!membership) {
    redirect("/register");
  }
  const summary = await getDashboardSummary({
    userId: user.id,
    organisationId: membership.organisationId,
    role: membership.role
  });

  return (
    <AppShell>
        <header className="page-header">
          <div>
            <p className="muted">Organisation</p>
            <h1>{membership.organisation.name}</h1>
            <div className="meta-row">
              <span>{user.email}</span>
              <span className="badge">{membership.role}</span>
            </div>
          </div>
          <div className="toolbar">
            <Link className="button" href="/invoices/new">New invoice</Link>
            <Link className="button subtle" href="/payments">Record payment</Link>
          </div>
        </header>

        <div className="summary-grid">
          <div className="stat">
            <span className="muted">Issued this month</span>
            <strong>{summary.invoicesIssuedThisMonth}</strong>
          </div>
          <div className="stat">
            <span className="muted">Invoice value</span>
            <strong>INR {summary.invoiceValueThisMonth.toString()}</strong>
          </div>
          <div className="stat">
            <span className="muted">Received</span>
            <strong>INR {summary.receivedThisMonth.toString()}</strong>
          </div>
          <div className="stat">
            <span className="muted">Outstanding</span>
            <strong>INR {summary.outstandingBalance.toString()}</strong>
          </div>
          <div className="stat">
            <span className="muted">Overdue</span>
            <strong>{summary.overdueInvoices}</strong>
          </div>
        </div>

        <div className="grid two-column">
          <div className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Activity</p>
                <h2>Recent invoices</h2>
              </div>
              <Link href="/invoices">View all</Link>
            </div>
            {summary.recentInvoices.length === 0 ? <div className="empty-state">No invoices yet.</div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Invoice</th><th>Buyer</th><th>Status</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {summary.recentInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber || "Draft"}</Link></td>
                        <td>{invoice.buyer?.displayName || "-"}</td>
                        <td><span className={`status-badge ${invoice.status}`}>{invoice.status.replace("_", " ")}</span></td>
                        <td>{invoice.currency} {invoice.balanceDue.toString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Receipts</p>
                <h2>Recent payments</h2>
              </div>
              <Link href="/payments">View all</Link>
            </div>
            {summary.recentPayments.length === 0 ? <div className="empty-state">No payments yet.</div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Invoice</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {summary.recentPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.paymentDate.toISOString().slice(0, 10)}</td>
                        <td>{payment.allocations[0]?.invoice.invoiceNumber || "-"}</td>
                        <td>{payment.currency} {payment.amount.toString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="panel top-space">
          <div className="section-title">
            <div>
              <p className="muted">Access</p>
              <h2>Enabled permissions</h2>
            </div>
          </div>
          <p className="muted">{permissionsForRole(membership.role).join(", ")}</p>
        </div>
    </AppShell>
  );
}
