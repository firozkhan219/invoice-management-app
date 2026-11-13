import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Eye, FilePlus2, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { listPackingLists, packingListIssueRequirements } from "@/lib/packing-lists/packing-list-service";
import { hasPermission } from "@/lib/permissions/roles";

export default async function PackingListsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");

  const filters = await searchParams;
  const packingLists = await listPackingLists(context, filters);
  const mayCreate = hasPermission(context.role, "invoices:create");

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Daily work</p>
          <h1>Packing Lists ({packingLists.length})</h1>
          <p className="muted">Make a packing list from an invoice, or on its own, in one page.</p>
        </div>
        {mayCreate ? (
          <div className="toolbar">
            <Link className="button" href="/packing-lists/new">
              <FilePlus2 size={18} />
              New packing list
            </Link>
          </div>
        ) : null}
      </header>

      <section className="panel">
        <form className="form" method="get">
          <div className="form-grid three">
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={filters?.q || ""} placeholder="Number, buyer or invoice" />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={filters?.status || ""}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="issued">Ready (PDF)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="source">Made from</label>
            <select id="source" name="source" defaultValue={filters?.source || ""}>
              <option value="">Anything</option>
              <option value="invoice">An invoice</option>
              <option value="manual">Typed in</option>
            </select>
          </div>
          </div>
          <div className="toolbar">
            <button className="button subtle" type="submit"><Search size={16} /> Search</button>
          </div>
        </form>
      </section>

      <section className="panel top-space">
        {packingLists.length === 0 ? (
          <div className="empty-state">
            <p>No packing lists yet.</p>
            {mayCreate ? <Link className="button" href="/packing-lists/new"><FilePlus2 size={18} /> Make your first packing list</Link> : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table register">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Buyer</th>
                  <th>Invoice</th>
                  <th>Boxes</th>
                  <th>Gross kg</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packingLists.map((packingList) => {
                  const state = packingListActionState(packingList);
                  return (
                    <tr key={packingList.id}>
                      <td>{packingList.packingListDate.toISOString().slice(0, 10)}</td>
                      <td>{packingList.packingListNumber || "Draft"}</td>
                      <td>{packingList.buyer?.displayName || "-"}</td>
                      <td>{packingList.invoice?.invoiceNumber || "-"}</td>
                      <td>{packingList.totalPackages}</td>
                      <td>{packingList.totalGrossWeightKg.toString()}</td>
                      <td><span className={`badge ${state.tone}`}>{state.label}</span></td>
                      <td>
                        <div className="row-actions compact">
                          <Link className="icon-button" href={`/packing-lists/${packingList.id}`} title="Open packing list"><Eye size={16} /></Link>
                          {packingList.status === "issued" ? (
                            <a className="icon-button" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer" title="Download PDF">
                              <Download size={16} />
                            </a>
                          ) : null}
                        </div>
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

function packingListActionState(packingList: Parameters<typeof packingListIssueRequirements>[0] & { status: string }) {
  if (packingList.status === "issued") return { label: "PDF ready", tone: "success" };
  if (packingList.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  const missing = packingListIssueRequirements(packingList);
  if (missing.length === 0) return { label: "Ready to finalise", tone: "success" };
  return { label: `Draft - ${missing[0]}`, tone: "warning" };
}
