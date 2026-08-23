import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listBuyers } from "@/lib/buyers/buyer-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

export default async function BuyersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    redirect("/register");
  }

  const buyers = await listBuyers(context);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Master data</p>
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
                    <th>Default addresses</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((buyer) => {
                    const billing = buyer.addresses.find((address) => address.isBillingDefault);
                    const shipping = buyer.addresses.find((address) => address.isShippingDefault);

                    return (
                      <tr key={buyer.id}>
                        <td>
                          <strong>{buyer.displayName}</strong>
                          {!buyer.isActive ? <span className="badge neutral">Inactive</span> : null}
                          <p className="muted">{buyer.legalName || "-"}</p>
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
                          <AddressSummary title="Billing" address={billing} />
                          <AddressSummary title="Consignee" address={shipping} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Buyer profile</p>
                <h2>Add buyer</h2>
              </div>
            </div>
            <form className="form" action="/api/buyers" method="post">
              <div className="field">
                <label htmlFor="displayName">Display name</label>
                <input id="displayName" name="displayName" required />
              </div>
              <div className="field">
                <label htmlFor="legalName">Legal name</label>
                <input id="legalName" name="legalName" />
              </div>
              <div className="field">
                <label htmlFor="contactPerson">Contact person</label>
                <input id="contactPerson" name="contactPerson" />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" />
                </div>
              </div>
              <div className="form-grid three">
                <div className="field">
                  <label htmlFor="gstin">GSTIN</label>
                  <input id="gstin" name="gstin" />
                </div>
                <div className="field">
                  <label htmlFor="pan">PAN</label>
                  <input id="pan" name="pan" />
                </div>
                <div className="field">
                  <label htmlFor="iec">IEC</label>
                  <input id="iec" name="iec" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="customerReference">Customer reference</label>
                <input id="customerReference" name="customerReference" />
              </div>
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" />
              </div>
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
            {buyers.length === 0 ? (
              <div className="empty-state">Create a buyer first.</div>
            ) : (
              <form className="form" action="/api/buyers/addresses" method="post">
                <div className="field">
                  <label htmlFor="buyerId">Buyer</label>
                  <select id="buyerId" name="buyerId" required>
                    {buyers.map((buyer) => (
                      <option key={buyer.id} value={buyer.id}>
                        {buyer.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="label">Address label</label>
                  <input id="label" name="label" placeholder="Billing office" required />
                </div>
                <div className="field">
                  <label htmlFor="addressLine1">Address line 1</label>
                  <input id="addressLine1" name="addressLine1" required />
                </div>
                <div className="field">
                  <label htmlFor="addressLine2">Address line 2</label>
                  <input id="addressLine2" name="addressLine2" />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="city">City</label>
                    <input id="city" name="city" required />
                  </div>
                  <div className="field">
                    <label htmlFor="state">State</label>
                    <input id="state" name="state" required />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="stateCode">State code</label>
                    <input id="stateCode" name="stateCode" />
                  </div>
                  <div className="field">
                    <label htmlFor="postcode">Postcode</label>
                    <input id="postcode" name="postcode" required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input id="country" name="country" defaultValue="India" required />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="addressEmail">Email</label>
                    <input id="addressEmail" name="email" type="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="addressPhone">Phone</label>
                    <input id="addressPhone" name="phone" />
                  </div>
                </div>
                <label className="checkbox">
                  <input type="checkbox" name="isBillingDefault" value="true" />
                  Default billing address
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="isShippingDefault" value="true" />
                  Default consignee/shipping address
                </label>
                <button className="button" type="submit">
                  Save address
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function AddressSummary({
  title,
  address
}: {
  title: string;
  address:
    | {
        label: string;
        city: string;
        state: string;
        country: string;
      }
    | undefined;
}) {
  return (
    <div>
      <strong>{title}</strong>
      <br />
      {address ? (
        <span className="muted">
          {address.label}, {address.city}, {address.state}, {address.country}
        </span>
      ) : (
        <span className="muted">Not set</span>
      )}
    </div>
  );
}
