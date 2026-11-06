import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listBuyers } from "@/lib/buyers/buyer-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";

type BuyerRow = Awaited<ReturnType<typeof listBuyers>>[number];
type AddressRow = BuyerRow["addresses"][number];

export default async function BuyersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    redirect("/login?error=" + encodeURIComponent("Your account has no active organisation."));
  }

  const buyers = await listBuyers(context);
  const canManage = hasPermission(context.role, "masters:manage");
  const activeBuyers = buyers.filter((buyer) => buyer.isActive);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Saved records</p>
          <h1>Buyers</h1>
        </div>
      </header>
      <div className="grid two-column">
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="muted">Customers and consignees</p>
              <h2>{buyers.length} buyers</h2>
            </div>
          </div>
          {buyers.length === 0 ? (
            <div className="empty-state">No buyers yet. Add your first buyer or consignee.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Tax IDs</th>
                    <th>Contact</th>
                    <th>Addresses</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((buyer) => (
                    <tr key={buyer.id}>
                      <td>
                        <strong>{buyer.displayName}</strong>
                        {!buyer.isActive ? <span className="badge neutral">Inactive</span> : null}
                        <p className="muted">{buyer.legalName || "-"}</p>
                        {canManage ? (
                          <div className="line-actions">
                            <BuyerEditForm buyer={buyer} />
                            <ToggleForm kind="buyer" id={buyer.id} isActive={buyer.isActive} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div>GSTIN: {buyer.gstin || "-"}</div>
                        <div>PAN: {buyer.pan || "-"}</div>
                        <div>IEC: {buyer.iec || "-"}</div>
                        <div>Ref: {buyer.customerReference || "-"}</div>
                      </td>
                      <td>
                        <div>{buyer.contactPerson || "-"}</div>
                        <div className="muted">{buyer.email || "-"}</div>
                        <div className="muted">{buyer.phone || "-"}</div>
                      </td>
                      <td>
                        {buyer.addresses.length === 0 ? (
                          <span className="muted">No addresses</span>
                        ) : (
                          buyer.addresses.map((address) => (
                            <div key={address.id}>
                              <strong>{address.label}</strong>
                              {address.isBillingDefault ? <span className="badge">Billing</span> : null}
                              {address.isShippingDefault ? <span className="badge">Shipping</span> : null}
                              {!address.isActive ? <span className="badge neutral">Inactive</span> : null}
                              <br />
                              <span className="muted">
                                {address.city}, {address.state}{address.stateCode ? ` (${address.stateCode})` : ""}, {address.country}
                              </span>
                              {canManage ? (
                                <div className="line-actions">
                                  <AddressEditForm address={address} />
                                  <ToggleForm kind="address" id={address.id} isActive={address.isActive} />
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {canManage ? (
          <aside className="grid">
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Buyer profile</p>
                  <h2>Add buyer</h2>
                </div>
              </div>
              <form className="form" action="/api/buyers" method="post">
                <BuyerFields idPrefix="new" />
                <button className="button" type="submit">
                  Save buyer
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="muted">Billing and consignee</p>
                  <h2>Add address</h2>
                </div>
              </div>
              {activeBuyers.length === 0 ? (
                <div className="empty-state">Create a buyer first.</div>
              ) : (
                <form className="form" action="/api/buyers/addresses" method="post">
                  <div className="field">
                    <label htmlFor="buyerId">Buyer</label>
                    <select id="buyerId" name="buyerId" required>
                      {activeBuyers.map((buyer) => (
                        <option key={buyer.id} value={buyer.id}>
                          {buyer.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AddressFields idPrefix="new-address" />
                  <button className="button" type="submit">
                    Save address
                  </button>
                </form>
              )}
            </section>
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}

function ToggleForm({ kind, id, isActive }: { kind: "buyer" | "address"; id: string; isActive: boolean }) {
  return (
    <form action="/api/buyers/toggle" method="post">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button className={isActive ? "inline-action danger" : "inline-action"} type="submit">
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}

function BuyerEditForm({ buyer }: { buyer: BuyerRow }) {
  return (
    <details className="details compact">
      <summary>Edit</summary>
      <form className="form compact-form" action="/api/buyers/update" method="post">
        <input type="hidden" name="buyerId" value={buyer.id} />
        <BuyerFields idPrefix={`buyer-${buyer.id}`} buyer={buyer} />
        <button className="button" type="submit">Save buyer</button>
      </form>
    </details>
  );
}

function BuyerFields({ idPrefix, buyer }: { idPrefix: string; buyer?: BuyerRow }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("displayName")}>Display name</label>
        <input id={id("displayName")} name="displayName" defaultValue={buyer?.displayName} required />
      </div>
      <div className="field">
        <label htmlFor={id("legalName")}>Legal name</label>
        <input id={id("legalName")} name="legalName" defaultValue={buyer?.legalName ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("contactPerson")}>Contact person</label>
        <input id={id("contactPerson")} name="contactPerson" defaultValue={buyer?.contactPerson ?? ""} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("email")}>Email</label>
          <input id={id("email")} name="email" type="email" defaultValue={buyer?.email ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("phone")}>Phone</label>
          <input id={id("phone")} name="phone" defaultValue={buyer?.phone ?? ""} />
        </div>
      </div>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor={id("gstin")}>GSTIN</label>
          <input id={id("gstin")} name="gstin" maxLength={15} defaultValue={buyer?.gstin ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("pan")}>PAN</label>
          <input id={id("pan")} name="pan" maxLength={10} defaultValue={buyer?.pan ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("iec")}>IEC</label>
          <input id={id("iec")} name="iec" maxLength={20} defaultValue={buyer?.iec ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("customerReference")}>Customer reference</label>
        <input id={id("customerReference")} name="customerReference" defaultValue={buyer?.customerReference ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("notes")}>Notes</label>
        <textarea id={id("notes")} name="notes" defaultValue={buyer?.notes ?? ""} />
      </div>
    </>
  );
}

function AddressEditForm({ address }: { address: AddressRow }) {
  return (
    <details className="details compact">
      <summary>Edit</summary>
      <form className="form compact-form" action="/api/buyers/addresses/update" method="post">
        <input type="hidden" name="addressId" value={address.id} />
        <AddressFields idPrefix={`address-${address.id}`} address={address} />
        <button className="button" type="submit">Save address</button>
      </form>
    </details>
  );
}

function AddressFields({ idPrefix, address }: { idPrefix: string; address?: AddressRow }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("label")}>Address label</label>
        <input id={id("label")} name="label" placeholder="Billing office" defaultValue={address?.label} required />
      </div>
      <div className="field">
        <label htmlFor={id("addressLine1")}>Address line 1</label>
        <input id={id("addressLine1")} name="addressLine1" defaultValue={address?.addressLine1} required />
      </div>
      <div className="field">
        <label htmlFor={id("addressLine2")}>Address line 2</label>
        <input id={id("addressLine2")} name="addressLine2" defaultValue={address?.addressLine2 ?? ""} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("city")}>City</label>
          <input id={id("city")} name="city" defaultValue={address?.city} required />
        </div>
        <div className="field">
          <label htmlFor={id("state")}>State</label>
          <input id={id("state")} name="state" defaultValue={address?.state} required />
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("stateCode")}>State code</label>
          <input id={id("stateCode")} name="stateCode" maxLength={10} placeholder="09" defaultValue={address?.stateCode ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("postcode")}>Postcode</label>
          <input id={id("postcode")} name="postcode" defaultValue={address?.postcode} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("country")}>Country</label>
        <input id={id("country")} name="country" defaultValue={address?.country ?? "India"} required />
      </div>
      <div className="field">
        <label htmlFor={id("contactPerson")}>Contact person</label>
        <input id={id("contactPerson")} name="contactPerson" defaultValue={address?.contactPerson ?? ""} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("email")}>Email</label>
          <input id={id("email")} name="email" type="email" defaultValue={address?.email ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("phone")}>Phone</label>
          <input id={id("phone")} name="phone" defaultValue={address?.phone ?? ""} />
        </div>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="isBillingDefault" value="true" defaultChecked={address?.isBillingDefault} />
        Default billing address
      </label>
      <label className="checkbox">
        <input type="checkbox" name="isShippingDefault" value="true" defaultChecked={address?.isShippingDefault} />
        Default consignee/shipping address
      </label>
    </>
  );
}
