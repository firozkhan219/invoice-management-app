import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalogueWorkspace } from "@/lib/catalogue/catalogue-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { CatalogueBuilder } from "./catalogue-builder";

export default async function CataloguePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));

  const { items, categories, companies } = await getCatalogueWorkspace(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Share your products</p>
          <h1>Catalogue</h1>
          <p className="muted">Make a photo catalogue PDF in four steps: choose products, pick the layout, tick the details, download.</p>
        </div>
      </header>
      <CatalogueBuilder products={items} categories={categories} companies={companies} />
    </AppShell>
  );
}
