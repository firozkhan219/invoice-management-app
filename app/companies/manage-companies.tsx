import type { listCompanies } from "@/lib/companies/company-service";

type CompanyRow = Awaited<ReturnType<typeof listCompanies>>[number];
type BankRow = CompanyRow["bankAccounts"][number];

/** Edit and activate/deactivate controls for companies and their bank accounts. */
export function ManageCompaniesSection({ companies }: { companies: CompanyRow[] }) {
  if (companies.length === 0) return null;
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <p className="muted">Maintenance</p>
          <h2>Edit companies &amp; bank accounts</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Company / bank account</th><th>State code</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {companies.flatMap((company) => [
              <tr key={company.id}>
                <td><strong>{company.legalName}</strong>{company.isDefault ? <span className="badge"> Default</span> : null}</td>
                <td>{company.stateCode || <span className="muted">Missing</span>}</td>
                <td>{company.isActive ? "Active" : <span className="badge neutral">Inactive</span>}</td>
                <td>
                  <div className="line-actions">
                    <CompanyEditForm company={company} />
                    <ToggleForm action="/api/companies/toggle" kind="company" id={company.id} isActive={company.isActive} />
                  </div>
                </td>
              </tr>,
              ...company.bankAccounts.map((account) => (
                <tr key={account.id}>
                  <td>&nbsp;&nbsp;{account.bankName} · {account.maskedAccountNumber} ({account.currency}){account.isDefault ? <span className="badge"> Default</span> : null}</td>
                  <td>-</td>
                  <td>{account.isActive ? "Active" : <span className="badge neutral">Inactive</span>}</td>
                  <td>
                    <div className="line-actions">
                      <BankAccountEditForm account={account} />
                      <ToggleForm action="/api/companies/toggle" kind="bank_account" id={account.id} isActive={account.isActive} />
                    </div>
                  </td>
                </tr>
              ))
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToggleForm({ action, kind, id, isActive }: { action: string; kind: string; id: string; isActive: boolean }) {
  return (
    <form action={action} method="post">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <button className={isActive ? "inline-action danger" : "inline-action"} type="submit">
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}

function CompanyEditForm({ company }: { company: CompanyRow }) {
  const prefix = `company-${company.id}`;
  return (
    <details className="details compact">
      <summary>Edit</summary>
      <form className="form compact-form" action="/api/companies/update" method="post">
        <input type="hidden" name="companyId" value={company.id} />
        <CompanyFields idPrefix={prefix} company={company} />
        <label className="checkbox">
          <input type="checkbox" name="isDefault" value="true" defaultChecked={company.isDefault} />
          Default company
        </label>
        <button className="button" type="submit">Save company</button>
      </form>
    </details>
  );
}

function CompanyFields({ idPrefix, company }: { idPrefix: string; company?: CompanyRow }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("legalName")}>Legal name</label>
        <input id={id("legalName")} name="legalName" defaultValue={company?.legalName} required />
      </div>
      <div className="field">
        <label htmlFor={id("tradingName")}>Trading name</label>
        <input id={id("tradingName")} name="tradingName" defaultValue={company?.tradingName ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("addressLine1")}>Address line 1</label>
        <input id={id("addressLine1")} name="addressLine1" defaultValue={company?.addressLine1} required />
      </div>
      <div className="field">
        <label htmlFor={id("addressLine2")}>Address line 2</label>
        <input id={id("addressLine2")} name="addressLine2" defaultValue={company?.addressLine2 ?? ""} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("city")}>City</label>
          <input id={id("city")} name="city" defaultValue={company?.city} required />
        </div>
        <div className="field">
          <label htmlFor={id("state")}>State</label>
          <input id={id("state")} name="state" placeholder="Uttar Pradesh" defaultValue={company?.state} required />
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("stateCode")}>State code</label>
          <input id={id("stateCode")} name="stateCode" maxLength={10} placeholder="09" defaultValue={company?.stateCode ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("postcode")}>Postcode</label>
          <input id={id("postcode")} name="postcode" defaultValue={company?.postcode} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("country")}>Country</label>
        <input id={id("country")} name="country" defaultValue={company?.country ?? "India"} required />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("phone")}>Phone</label>
          <input id={id("phone")} name="phone" defaultValue={company?.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("email")}>Email</label>
          <input id={id("email")} name="email" type="email" defaultValue={company?.email ?? ""} />
        </div>
      </div>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor={id("gstin")}>GSTIN</label>
          <input id={id("gstin")} name="gstin" maxLength={15} defaultValue={company?.gstin ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("pan")}>PAN</label>
          <input id={id("pan")} name="pan" maxLength={10} defaultValue={company?.pan ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("iec")}>IEC</label>
          <input id={id("iec")} name="iec" maxLength={20} defaultValue={company?.iec ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("signatoryName")}>Signatory name</label>
        <input id={id("signatoryName")} name="signatoryName" defaultValue={company?.signatoryName ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("signatoryDesignation")}>Signatory designation</label>
        <input id={id("signatoryDesignation")} name="signatoryDesignation" defaultValue={company?.signatoryDesignation ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("defaultDeclaration")}>Default declaration</label>
        <textarea id={id("defaultDeclaration")} name="defaultDeclaration" defaultValue={company?.defaultDeclaration ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("defaultTerms")}>Default terms</label>
        <textarea id={id("defaultTerms")} name="defaultTerms" defaultValue={company?.defaultTerms ?? ""} />
      </div>
    </>
  );
}

function BankAccountEditForm({ account }: { account: BankRow }) {
  const prefix = `bank-${account.id}`;
  return (
    <details className="details compact">
      <summary>Edit</summary>
      <form className="form compact-form" action="/api/companies/bank-accounts/update" method="post">
        <input type="hidden" name="bankAccountId" value={account.id} />
        <BankFields idPrefix={prefix} account={account} />
        <div className="field">
          <label htmlFor={`${prefix}-accountNumber`}>New account number</label>
          <input id={`${prefix}-accountNumber`} name="accountNumber" placeholder={`Leave blank to keep ${account.maskedAccountNumber}`} />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="isDefault" value="true" defaultChecked={account.isDefault} />
          Default bank account
        </label>
        <button className="button" type="submit">Save bank account</button>
      </form>
    </details>
  );
}

function BankFields({ idPrefix, account }: { idPrefix: string; account?: BankRow }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("bankName")}>Bank name</label>
        <input id={id("bankName")} name="bankName" defaultValue={account?.bankName} required />
      </div>
      <div className="field">
        <label htmlFor={id("accountHolderName")}>Account holder</label>
        <input id={id("accountHolderName")} name="accountHolderName" defaultValue={account?.accountHolderName} required />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={id("ifsc")}>IFSC</label>
          <input id={id("ifsc")} name="ifsc" defaultValue={account?.ifsc ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={id("swiftBic")}>SWIFT/BIC</label>
          <input id={id("swiftBic")} name="swiftBic" defaultValue={account?.swiftBic ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id("branchName")}>Branch name</label>
        <input id={id("branchName")} name="branchName" defaultValue={account?.branchName ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("branchAddress")}>Branch address</label>
        <textarea id={id("branchAddress")} name="branchAddress" defaultValue={account?.branchAddress ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={id("currency")}>Currency</label>
        <input id={id("currency")} name="currency" defaultValue={account?.currency ?? "INR"} required />
      </div>
    </>
  );
}
