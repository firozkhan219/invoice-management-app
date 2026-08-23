import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { getPaymentEntryData, listPayments } from "@/lib/payments/payment-service";

export default async function PaymentsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");

  const query = await searchParams;
  const { invoices, bankAccounts } = await getPaymentEntryData(context);
  const payments = await listPayments(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Transactions</p>
          <h1>Payments</h1>
        </div>
      </header>
      <div className="grid two-column">
        <section className="panel">
          {query?.error ? <p className="notice error">{query.error}</p> : null}
          <div className="section-title">
            <div>
              <p className="muted">Receipts</p>
              <h2>{payments.length} payments</h2>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="empty-state">No payments recorded yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Invoice</th><th>Buyer</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const allocation = payment.allocations[0];
                    const invoice = allocation?.invoice;
                    return (
                      <tr key={payment.id}>
                        <td>{payment.paymentDate.toISOString().slice(0, 10)}</td>
                        <td>{invoice ? <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber || invoice.id}</Link> : "-"}</td>
                        <td>{invoice?.buyer?.displayName || "-"}</td>
                        <td>{payment.currency} {payment.amount.toString()}</td>
                        <td><span className="badge">{payment.status}</span></td>
                        <td>
                          {payment.status === "posted" ? (
                            <form className="inline-form" action="/api/payments/reverse" method="post">
                              <input type="hidden" name="paymentId" value={payment.id} />
                              <input type="hidden" name="reason" value="Reversed from payments screen" />
                              <button className="button subtle" type="submit">Reverse</button>
                            </form>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-title">
            <div>
              <p className="muted">Allocation</p>
              <h2>Record payment</h2>
            </div>
          </div>
          {invoices.length === 0 ? (
            <div className="empty-state">No issued invoices with outstanding balance.</div>
          ) : (
            <form className="form" action="/api/payments" method="post">
              <div className="field">
                <label htmlFor="invoiceId">Invoice</label>
                <select id="invoiceId" name="invoiceId" required>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber || invoice.id} - {invoice.buyer?.displayName || "No buyer"} - Balance {invoice.currency} {invoice.balanceDue.toString()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="paymentDate">Payment date</label>
                  <input id="paymentDate" name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <input id="currency" name="currency" defaultValue="INR" required maxLength={3} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="amount">Amount</label>
                <input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="field">
                <label htmlFor="paymentMethod">Payment method</label>
                <select id="paymentMethod" name="paymentMethod" required>
                  <option value="Bank transfer">Bank transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="referenceNumber">Reference number</label>
                <input id="referenceNumber" name="referenceNumber" />
              </div>
              <div className="field">
                <label htmlFor="bankAccountId">Bank account</label>
                <select id="bankAccountId" name="bankAccountId" defaultValue="">
                  <option value="">Not selected</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bankName} - {account.accountNumberLast4}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" />
              </div>
              <button className="button" type="submit">Record payment</button>
            </form>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
