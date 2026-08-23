import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listItemMasters } from "@/lib/items/item-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export default async function ItemsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    redirect("/register");
  }

  const { units, taxRates, items } = await listItemMasters(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Master data</p>
          <h1>Items</h1>
        </div>
      </header>
      <div className="summary-grid">
        <div className="stat"><span className="muted">Units</span><strong>{units.length}</strong></div>
        <div className="stat"><span className="muted">Tax rates</span><strong>{taxRates.length}</strong></div>
        <div className="stat"><span className="muted">Items</span><strong>{items.length}</strong></div>
      </div>
      <div className="grid two-column">
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="muted">Catalog</p>
              <h2>{items.length} items</h2>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">No items yet. Add units and tax rates, then create items.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>HSN/SAC</th>
                    <th>Unit</th>
                    <th>Tax</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {!item.isActive ? <span className="badge neutral">Inactive</span> : null}
                        <p className="muted">{item.sku || "-"}</p>
                      </td>
                      <td>{item.hsnSac || "-"}</td>
                      <td>{item.unit ? item.unit.code : "-"}</td>
                      <td>{item.taxRate ? `${item.taxRate.name} (${item.taxRate.rate.toString()}%)` : "-"}</td>
                      <td>
                        {item.saleRate ? `${item.currency} ${item.saleRate.toString()}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Measurement</p>
                <h2>Add unit</h2>
              </div>
            </div>
            <form className="form" action="/api/items/units" method="post">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="code">Code</label>
                  <input id="code" name="code" placeholder="PCS" required />
                </div>
                <div className="field">
                  <label htmlFor="precision">Precision</label>
                  <input id="precision" name="precision" type="number" defaultValue="2" min="0" max="6" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="unitName">Name</label>
                <input id="unitName" name="name" placeholder="Pieces" required />
              </div>
              <label className="checkbox">
                <input type="checkbox" name="isDefault" value="true" />
                Default unit
              </label>
              <button className="button" type="submit">Save unit</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">GST setup</p>
                <h2>Add tax rate</h2>
              </div>
            </div>
            <form className="form" action="/api/items/tax-rates" method="post">
              <div className="field">
                <label htmlFor="taxName">Name</label>
                <input id="taxName" name="name" placeholder="GST 5%" required />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="rate">Rate %</label>
                  <input id="rate" name="rate" type="number" step="0.0001" min="0" max="100" required />
                </div>
                <div className="field">
                  <label htmlFor="taxType">Type</label>
                  <select id="taxType" name="taxType" defaultValue="gst">
                    <option value="gst">GST</option>
                    <option value="export_zero_rated">Export zero-rated</option>
                    <option value="no_tax">No tax</option>
                  </select>
                </div>
              </div>
              <label className="checkbox">
                <input type="checkbox" name="isDefault" value="true" />
                Default tax rate
              </label>
              <button className="button" type="submit">Save tax rate</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Catalog item</p>
                <h2>Add item</h2>
              </div>
            </div>
            <form className="form" action="/api/items" method="post">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="sku">SKU</label>
                  <input id="sku" name="sku" />
                </div>
                <div className="field">
                  <label htmlFor="hsnSac">HSN/SAC</label>
                  <input id="hsnSac" name="hsnSac" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="itemName">Name</label>
                <input id="itemName" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="unitId">Unit</label>
                  <select id="unitId" name="unitId" defaultValue="">
                    <option value="">None</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="taxRateId">Tax rate</label>
                  <select id="taxRateId" name="taxRateId" defaultValue="">
                    <option value="">None</option>
                    {taxRates.map((taxRate) => (
                      <option key={taxRate.id} value={taxRate.id}>
                        {taxRate.name} - {taxRate.rate.toString()}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="saleRate">Sale rate</label>
                  <input id="saleRate" name="saleRate" type="number" min="0" step="0.0001" />
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <input id="currency" name="currency" defaultValue="INR" required />
                </div>
              </div>
              <button className="button" type="submit">Save item</button>
            </form>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
