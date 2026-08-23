import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Reports</p>
          <h1>Invoice register</h1>
        </div>
      </header>
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="muted">Export</p>
            <h2>CSV download</h2>
          </div>
        </div>
        <p className="muted">Export the current invoice register with stable CSV headers for Excel.</p>
        <a className="button" href="/api/reports/invoice-register">
          <Download size={18} />
          Download CSV
        </a>
      </section>
    </AppShell>
  );
}
