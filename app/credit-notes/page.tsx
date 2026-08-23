import Link from "next/link";
import { redirect } from "next/navigation";
import { FileMinus2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listCreditNotes } from "@/lib/credit-notes/credit-note-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export default async function CreditNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");
  const creditNotes = await listCreditNotes(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Corrections</p>
          <h1>Credit Notes</h1>
        </div>
      </header>
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="muted">Register</p>
            <h2>{creditNotes.length} credit notes</h2>
          </div>
          <FileMinus2 size={20} />
        </div>
        {creditNotes.length === 0 ? (
          <div className="empty-state">No credit notes yet. Open an issued invoice to create one.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Number</th><th>Original invoice</th><th>Buyer</th><th>Status</th><th>Total</th></tr>
              </thead>
              <tbody>
                {creditNotes.map((creditNote) => (
                  <tr key={creditNote.id}>
                    <td><Link href={`/credit-notes/${creditNote.id}`}>{creditNote.creditNoteDate.toISOString().slice(0, 10)}</Link></td>
                    <td>{creditNote.creditNoteNumber || "Draft"}</td>
                    <td>
                      <Link href={`/invoices/${creditNote.originalInvoiceId}`}>
                        {creditNote.originalInvoice.invoiceNumber || creditNote.originalInvoiceId}
                      </Link>
                    </td>
                    <td>{creditNote.originalInvoice.buyer?.displayName || "-"}</td>
                    <td><span className={`status-badge ${creditNote.status}`}>{creditNote.status}</span></td>
                    <td>{creditNote.currency} {creditNote.grandTotal.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
