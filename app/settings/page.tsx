import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { getSettingsWorkspace } from "@/lib/settings/settings-service";
import { renderInvoiceNumber, resetKeyForRule } from "@/lib/settings/number-series";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");

  const query = await searchParams;
  const { organisation, settings, companies, bankAccounts, lockedPeriods, series, creditNoteSeries } =
    await getSettingsWorkspace(context);
  const previewDate = new Date();

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="muted">Organisation</p>
          <h1>Settings</h1>
        </div>
      </header>
      {query?.error ? <p className="notice error">{query.error}</p> : null}
      <div className="grid two-column">
        <div className="stack">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Defaults</p>
                <h2>Organisation settings</h2>
              </div>
            </div>
            <table className="table compact">
              <tbody>
                <tr><th>Locale</th><td>{organisation.locale}</td></tr>
                <tr><th>Time zone</th><td>{organisation.timeZone}</td></tr>
                <tr><th>Currency</th><td>{organisation.defaultCurrency}</td></tr>
                <tr><th>Financial year starts</th><td>Month {organisation.financialYearStart}</td></tr>
                <tr><th>Invoice title</th><td>{settings?.defaultInvoiceTitle || "Tax Invoice"}</td></tr>
                <tr><th>Tax mode</th><td>{settings?.defaultTaxMode || "automatic"}</td></tr>
                <tr><th>Rounding</th><td>{settings?.roundingPolicy || "nearest_rupee"}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Corrections</p>
                <h2>Credit note number series</h2>
              </div>
            </div>
            {creditNoteSeries.length === 0 ? (
              <div className="empty-state">No credit note number series yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Pattern</th><th>Next</th><th>Preview</th><th>Scope</th></tr>
                  </thead>
                  <tbody>
                    {creditNoteSeries.map((item) => {
                      const nextNumber = previewInvoiceNumber(item, previewDate, organisation.financialYearStart);

                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            {item.isDefault ? <span className="badge">Default</span> : null}
                            <span className={item.isActive ? "badge" : "badge neutral"}>{item.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td>{item.pattern}</td>
                          <td>{item.isActive ? nextNumber.sequence : "-"}</td>
                          <td>{item.isActive ? nextNumber.number : "-"}</td>
                          <td>{item.company?.legalName || "All companies"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Numbering</p>
                <h2>Invoice number series</h2>
              </div>
            </div>
            {series.length === 0 ? (
              <div className="empty-state">No number series yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Pattern</th><th>Next</th><th>Preview</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {series.map((item) => {
                      const nextNumber = previewInvoiceNumber(item, previewDate, organisation.financialYearStart);

                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            {item.isDefault ? <span className="badge">Default</span> : null}
                            <span className={item.isActive ? "badge" : "badge neutral"}>{item.isActive ? "Active" : "Inactive"}</span>
                            <p className="muted">{item.company?.legalName || "All companies"}</p>
                          </td>
                          <td>{item.pattern}</td>
                          <td>{item.isActive ? nextNumber.sequence : "-"}</td>
                          <td>{item.isActive ? nextNumber.number : "-"}</td>
                          <td>
                            <div className="action-stack compact">
                              {item.isActive && !item.isDefault ? (
                                <form action="/api/settings/number-series" method="post">
                                  <input type="hidden" name="seriesId" value={item.id} />
                                  <input type="hidden" name="action" value="make_default" />
                                  <button className="button subtle" type="submit">Make default</button>
                                </form>
                              ) : null}
                              {item.isActive ? (
                                <form action="/api/settings/number-series" method="post">
                                  <input type="hidden" name="seriesId" value={item.id} />
                                  <input type="hidden" name="action" value="deactivate" />
                                  <button className="button subtle" type="submit">Deactivate</button>
                                </form>
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

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Controls</p>
                <h2>Locked periods</h2>
              </div>
            </div>
            {lockedPeriods.length === 0 ? (
              <div className="empty-state">No locked periods.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Range</th><th>Status</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {lockedPeriods.map((period) => (
                      <tr key={period.id}>
                        <td>{period.name}</td>
                        <td>
                          {period.startsOn.toISOString().slice(0, 10)} to {period.endsOn.toISOString().slice(0, 10)}
                        </td>
                        <td><span className={period.isActive ? "badge" : "badge neutral"}>{period.isActive ? "Active" : "Inactive"}</span></td>
                        <td>{period.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Preferences</p>
                <h2>Update settings</h2>
              </div>
            </div>
            <form className="form" action="/api/settings" method="post">
              <div className="field">
                <label htmlFor="defaultInvoiceTitle">Default invoice title</label>
                <input id="defaultInvoiceTitle" name="defaultInvoiceTitle" defaultValue={settings?.defaultInvoiceTitle || "Tax Invoice"} required />
              </div>
              <div className="field">
                <label htmlFor="defaultCompanyId">Default company</label>
                <select id="defaultCompanyId" name="defaultCompanyId" defaultValue={settings?.defaultCompanyId || ""}>
                  <option value="">None</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.legalName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="defaultBankAccountId">Default bank account</label>
                <select id="defaultBankAccountId" name="defaultBankAccountId" defaultValue={settings?.defaultBankAccountId || ""}>
                  <option value="">None</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bankName} - {account.accountNumberLast4}</option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="defaultTaxMode">Tax mode</label>
                  <select id="defaultTaxMode" name="defaultTaxMode" defaultValue={settings?.defaultTaxMode || "automatic"}>
                    <option value="automatic">Automatic</option>
                    <option value="igst">IGST</option>
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="zero_rated_export">Zero-rated export</option>
                    <option value="no_tax">No tax</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="roundingPolicy">Rounding</label>
                  <select id="roundingPolicy" name="roundingPolicy" defaultValue={settings?.roundingPolicy || "nearest_rupee"}>
                    <option value="nearest_rupee">Nearest rupee</option>
                    <option value="two_decimals">Two decimals</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="defaultDeclaration">Default declaration</label>
                <textarea id="defaultDeclaration" name="defaultDeclaration" defaultValue={settings?.defaultDeclaration || ""} />
              </div>
              <div className="field">
                <label htmlFor="paymentTerms">Payment terms</label>
                <textarea id="paymentTerms" name="paymentTerms" defaultValue={settings?.paymentTerms || ""} />
              </div>
              <label className="checkbox"><input type="checkbox" name="showPageNumbers" value="true" defaultChecked={settings?.showPageNumbers ?? true} /> Show page numbers</label>
              <label className="checkbox"><input type="checkbox" name="draftAutosave" value="true" defaultChecked={settings?.draftAutosave ?? true} /> Draft autosave</label>
              <label className="checkbox"><input type="checkbox" name="numberOnIssue" value="true" defaultChecked={settings?.numberOnIssue ?? true} /> Number on issue</label>
              <label className="checkbox"><input type="checkbox" name="allowManualNumberOverride" value="true" defaultChecked={settings?.allowManualNumberOverride ?? false} /> Allow manual number override</label>
              <label className="checkbox"><input type="checkbox" name="allowManualDateOverride" value="true" defaultChecked={settings?.allowManualDateOverride ?? false} /> Allow manual date override</label>
              <button className="button" type="submit">Save settings</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Numbering</p>
                <h2>Add number series</h2>
              </div>
            </div>
            <form className="form" action="/api/settings/number-series" method="post">
              <div className="field"><label htmlFor="seriesName">Name</label><input id="seriesName" name="name" required /></div>
              <div className="field"><label htmlFor="pattern">Pattern</label><input id="pattern" name="pattern" defaultValue="INV/{FY}/{SEQ:4}" required /></div>
              <div className="field"><label htmlFor="prefix">Prefix</label><input id="prefix" name="prefix" placeholder="INV" /></div>
              <div className="field">
                <label htmlFor="companyId">Company scope</label>
                <select id="companyId" name="companyId" defaultValue="">
                  <option value="">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.legalName}</option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="padding">Padding</label><input id="padding" name="padding" type="number" min="1" max="12" defaultValue="4" /></div>
                <div className="field"><label htmlFor="startingNumber">Starting number</label><input id="startingNumber" name="startingNumber" type="number" min="1" defaultValue="1" /></div>
              </div>
              <div className="field">
                <label htmlFor="resetRule">Reset rule</label>
                <select id="resetRule" name="resetRule" defaultValue="financial_year">
                  <option value="financial_year">Financial year</option>
                  <option value="calendar_year">Calendar year</option>
                  <option value="never">Never</option>
                </select>
              </div>
              <label className="checkbox"><input type="checkbox" name="isDefault" value="true" /> Default series</label>
              <button className="button" type="submit">Save series</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Corrections</p>
                <h2>Add credit note series</h2>
              </div>
            </div>
            <form className="form" action="/api/settings/credit-note-series" method="post">
              <div className="field"><label htmlFor="creditSeriesName">Name</label><input id="creditSeriesName" name="name" required /></div>
              <div className="field"><label htmlFor="creditPattern">Pattern</label><input id="creditPattern" name="pattern" defaultValue="CN/{FY}/{SEQ:4}" required /></div>
              <div className="field"><label htmlFor="creditPrefix">Prefix</label><input id="creditPrefix" name="prefix" placeholder="CN" /></div>
              <div className="field">
                <label htmlFor="creditCompanyId">Company scope</label>
                <select id="creditCompanyId" name="companyId" defaultValue="">
                  <option value="">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.legalName}</option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="creditPadding">Padding</label><input id="creditPadding" name="padding" type="number" min="1" max="12" defaultValue="4" /></div>
                <div className="field"><label htmlFor="creditStartingNumber">Starting number</label><input id="creditStartingNumber" name="startingNumber" type="number" min="1" defaultValue="1" /></div>
              </div>
              <div className="field">
                <label htmlFor="creditResetRule">Reset rule</label>
                <select id="creditResetRule" name="resetRule" defaultValue="financial_year">
                  <option value="financial_year">Financial year</option>
                  <option value="calendar_year">Calendar year</option>
                  <option value="never">Never</option>
                </select>
              </div>
              <label className="checkbox"><input type="checkbox" name="isDefault" value="true" /> Default credit note series</label>
              <button className="button" type="submit">Save credit series</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <p className="muted">Close period</p>
                <h2>Add locked period</h2>
              </div>
            </div>
            <form className="form" action="/api/settings/locked-periods" method="post">
              <div className="field"><label htmlFor="periodName">Name</label><input id="periodName" name="name" required /></div>
              <div className="form-grid">
                <div className="field"><label htmlFor="startsOn">Starts on</label><input id="startsOn" name="startsOn" type="date" required /></div>
                <div className="field"><label htmlFor="endsOn">Ends on</label><input id="endsOn" name="endsOn" type="date" required /></div>
              </div>
              <div className="field"><label htmlFor="reason">Reason</label><textarea id="reason" name="reason" required /></div>
              <button className="button" type="submit">Lock period</button>
            </form>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function previewInvoiceNumber(
  series: {
    pattern: string;
    prefix: string | null;
    nextSequence: number;
    startingNumber: number;
    resetRule: "never" | "calendar_year" | "financial_year";
    lastResetKey: string | null;
  },
  date: Date,
  financialYearStartMonth: number
) {
  const resetKey = resetKeyForRule(series.resetRule, date, financialYearStartMonth);
  const sequence = resetKey !== null && series.lastResetKey !== resetKey
    ? series.startingNumber
    : series.nextSequence;

  return {
    sequence,
    number: renderInvoiceNumber({
      pattern: series.pattern,
      prefix: series.prefix,
      sequence,
      date,
      financialYearStartMonth
    })
  };
}
