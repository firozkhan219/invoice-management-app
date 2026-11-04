import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listItemMasters } from "@/lib/items/item-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";

type Masters = Awaited<ReturnType<typeof listItemMasters>>;
type ItemRow = Masters["items"][number];

export default async function ItemsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  }

  const { units, taxRates, items } = await listItemMasters(context);
  const canManage = hasPermission(context.role, "masters:manage");
  const activeUnits = units.filter((unit) => unit.isActive);
  const activeTaxRates = taxRates.filter((taxRate) => taxRate.isActive);

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
        <div className="grid">
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
                          {canManage ? (
                            <div className="line-actions">
                              <details className="details compact">
                                <summary>Edit</summary>
                                <form className="form compact-form" action="/api/items/update" method="post">
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <ItemFields idPrefix={`item-${item.id}`} item={item} units={units.filter((unit) => unit.isActive || unit.id === item.unitId)} taxRates={taxRates.filter((taxRate) => taxRate.isActive || taxRate.id === item.taxRateId)} />
                                  <button className="button" type="submit">Save item</button>
                                </form>
                              </details>
                              <ToggleForm kind="item" id={item.id} isActive={item.isActive} />
                            </div>
                          ) : null}
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

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Setup</p>
                <h2>Units and tax rates</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr><th>Unit</th><th>Name</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr>
                </thead>
                <tbody>
                  {units.length === 0 ? (
                    <tr><td colSpan={canManage ? 4 : 3} className="muted">No units yet.</td></tr>
                  ) : units.map((unit) => (
                    <tr key={unit.id}>
                      <td>{unit.code}{unit.isDefault ? <span className="badge">Default</span> : null}</td>
                      <td>{unit.name}</td>
                      <td>{unit.isActive ? "Active" : "Inactive"}</td>
                      {canManage ? <td><ToggleForm kind="unit" id={unit.id} isActive={unit.isActive} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="table compact">
                <thead>
                  <tr><th>Tax rate</th><th>Rate</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr>
                </thead>
                <tbody>
                  {taxRates.length === 0 ? (
                    <tr><td colSpan={canManage ? 4 : 3} className="muted">No tax rates yet.</td></tr>
                  ) : taxRates.map((taxRate) => (
                    <tr key={taxRate.id}>
                      <td>{taxRate.name}{taxRate.isDefault ? <span className="badge">Default</span> : null}</td>
                      <td>{taxRate.rate.toString()}%</td>
                      <td>{taxRate.isActive ? "Active" : "Inactive"}</td>
                      {canManage ? <td><ToggleForm kind="tax_rate" id={taxRate.id} isActive={taxRate.isActive} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {canManage ? (
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
                <ItemFields idPrefix="new" units={activeUnits} taxRates={activeTaxRates} />
                <button className="button" type="submit">Save item</button>
              </form>
            </section>
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}

function ToggleForm({ kind, id, isActive }: { kind: "item" | "unit" | "tax_rate"; id: string; isActive: boolean }) {
  return (
    <form action="/api/items/toggle" method="post">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button className={isActive ? "inline-action danger" : "inline-action"} type="submit">
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}

function ItemFields({
  idPrefix,
  item,
  units,
  taxRates
}: {
  idPrefix: string;
  item?: ItemRow;
  units: Masters["units"];
  taxRates: Masters["taxRates"];
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("sku")}>SKU</label>
          <input id={id("sku")} name="sku" defaultValue={item?.sku ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("hsnSac")}>HSN/SAC</label>
          <input id={id("hsnSac")} name="hsnSac" defaultValue={item?.hsnSac ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("name")}>Name</label>
        <input id={id("name")} name="name" defaultValue={item?.name} required />
      </div>
      <div className="field">
        <label htmlFor={id("description")}>Description</label>
        <textarea id={id("description")} name="description" defaultValue={item?.description ?? ""} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("unitId")}>Unit</label>
          <select id={id("unitId")} name="unitId" defaultValue={item?.unitId ?? ""}>
            <option value="">None</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id("taxRateId")}>Tax rate</label>
          <select id={id("taxRateId")} name="taxRateId" defaultValue={item?.taxRateId ?? ""}>
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
          <label htmlFor={id("saleRate")}>Sale rate</label>
          <input id={id("saleRate")} name="saleRate" type="number" min="0" step="0.0001" defaultValue={item?.saleRate?.toString() ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("currency")}>Currency</label>
          <input id={id("currency")} name="currency" defaultValue={item?.currency ?? "INR"} required />
        </div>
      </div>
    </>
  );
}
