import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, PackagePlus, Save, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { getPackingList, getPackingListWorkspace, packingListIssueRequirements, shipmentNeedsPorts } from "@/lib/packing-lists/packing-list-service";

export default async function PackingListDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getTenantContextForUser(user.id);
  if (!context) redirect("/register");

  const { id } = await params;
  const [packingList, workspace] = await Promise.all([
    getPackingList(context, id),
    getPackingListWorkspace(context)
  ]);

  if (!packingList) notFound();

  const canEdit = packingList.status === "draft";
  const issueRequirements = packingListIssueRequirements(packingList);
  const canIssue = canEdit && issueRequirements.length === 0;
  const readiness = packingListReadiness({
    hasCompany: Boolean(packingList.companyId),
    hasBuyer: Boolean(packingList.buyerId),
    hasLines: packingList.lines.length > 0,
    hasShipmentMode: Boolean(packingList.shipmentMode),
    hasRoute: Boolean(packingList.finalDestination && (!shipmentNeedsPorts(packingList.shipmentMode) || (packingList.portOfLoading && packingList.portOfDischarge))),
    hasWeights: packingList.totalGrossWeightKg.gt(0) && packingList.totalNetWeightKg.gt(0)
  });

  return (
    <AppShell>
      <div className="packing-detail">
        <main className="document-editor">
          <div className="document-toolbar">
            <div className="document-crumb">
              <strong>Documents</strong>
              <span>|</span>
              <span>Packing Lists</span>
            </div>
            <div className="toolbar">
              <Link className="button subtle tiny" href="/packing-lists">
                <ArrowLeft size={16} />
                All packing lists
              </Link>
              {canEdit ? (
                <button className="button tiny" form="packing-list-draft-form" type="submit">
                  <Save size={16} />
                  Save changes
                </button>
              ) : null}
              {packingList.status === "issued" ? (
                <a className="button tiny" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download size={16} />
                  Download PDF
                </a>
              ) : null}
            </div>
          </div>

          <section className="document-canvas">
            <div className="document-title-row">
              <h1>PACKING LIST</h1>
              <span>Page 1 of 1</span>
            </div>

            <div className="document-command-panel compact">
              <div>
                <p className="muted">{packingList.status === "issued" ? "Finalised" : "Before you finalise"}</p>
                <h2>{readiness.ready === readiness.total ? "All details complete" : `${readiness.ready} of ${readiness.total} details complete`}</h2>
              </div>
              <div className="readiness-list">
                {readiness.items.map((item) => (
                  <span className={item.done ? "ready-check done" : "ready-check"} key={item.label}>
                    {item.done ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="packing-totals-strip">
              <span><strong>{packingList.totalPackages}</strong><small>Packages</small></span>
              <span><strong>{packingList.totalQuantity.toString()}</strong><small>Quantity</small></span>
              <span><strong>{packingList.totalNetWeightKg.toString()} kg</strong><small>Net weight</small></span>
              <span><strong>{packingList.totalGrossWeightKg.toString()} kg</strong><small>Gross weight</small></span>
              <span><strong>{packingList.totalVolumeCbm.toString()} cbm</strong><small>Volume</small></span>
            </div>

            {canEdit ? (
              <form id="packing-list-draft-form" action="/api/packing-lists" method="post">
                <input type="hidden" name="packingListId" value={packingList.id} />
                <input type="hidden" name="version" value={packingList.version} />
                <PackingListDocumentFields packingList={packingList} workspace={workspace} />
              </form>
            ) : (
              <PackingListSnapshot packingList={packingList} />
            )}

            {canEdit && issueRequirements.length > 0 ? (
              <div className="notice error top-space">
                <strong>Still needed</strong>
                <span>{issueRequirements.join(", ")}.</span>
              </div>
            ) : null}

            {canEdit ? (
            <div className="document-action-row">
              <form action="/api/packing-lists/issue" method="post">
                <input type="hidden" name="packingListId" value={packingList.id} />
                <input type="hidden" name="expectedVersion" value={packingList.version} />
                <button className="button" type="submit" disabled={!canIssue}>
                  <Send size={18} />
                  Finalise &amp; make PDF
                </button>
              </form>
            </div>
            ) : null}

            <section className="document-lines">
              <div className="document-section-heading">
                <h2>Package Details</h2>
                <span className="badge neutral">{packingList.lines.length} lines</span>
              </div>
              {packingList.lines.length === 0 ? (
                <div className="empty-state">No packing rows yet. Add package details before issuing.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Package / Marks</th>
                        <th>Item / HSN</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Net KG</th>
                        <th>Gross KG</th>
                        <th>CBM</th>
                        {canEdit ? <th>Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {packingList.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.sortOrder}</td>
                          <td>
                            <strong>{line.packageNo || "-"}</strong>
                            <p className="muted">{line.marksAndNumbers || "-"}</p>
                          </td>
                          <td>
                            {line.sku || "-"}
                            <p className="muted">{line.hsnSac || "-"}</p>
                          </td>
                          <td>
                            {line.description}
                            <p className="muted">{line.lengthCm?.toString() || "-"} x {line.widthCm?.toString() || "-"} x {line.heightCm?.toString() || "-"} cm</p>
                          </td>
                          <td>{line.quantity.toString()} {line.unitCode || ""}</td>
                          <td>{line.netWeightKg.toString()}</td>
                          <td>{line.grossWeightKg.toString()}</td>
                          <td>{line.volumeCbm.toString()}</td>
                          {canEdit ? (
                            <td>
                              <form action="/api/packing-lists/lines/delete" method="post">
                                <input type="hidden" name="packingListId" value={packingList.id} />
                                <input type="hidden" name="lineId" value={line.id} />
                                <input type="hidden" name="expectedVersion" value={packingList.version} />
                                <button className="icon-button danger" title="Delete packing line" type="submit"><Trash2 size={16} /></button>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {canEdit ? (
              <details className="details top-space">
                <summary><PackagePlus size={16} /> Add package line</summary>
                <form className="form top-space" action="/api/packing-lists/lines" method="post">
                  <input type="hidden" name="packingListId" value={packingList.id} />
                  <input type="hidden" name="expectedVersion" value={packingList.version} />
                  <input type="hidden" name="sortOrder" value={packingList.lines.length + 1} />
                  <div className="field">
                    <label htmlFor="invoiceItemId">Source invoice line</label>
                    <select id="invoiceItemId" name="invoiceItemId" defaultValue="">
                      <option value="">Manual row</option>
                      {packingList.invoice?.items.map((item) => (
                        <option key={item.id} value={item.id}>{item.sortOrder} - {item.description.slice(0, 80)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="itemId">Catalog item</label>
                    <select id="itemId" name="itemId" defaultValue="">
                      <option value="">None</option>
                      {workspace.items.map((item) => <option key={item.id} value={item.id}>{item.sku || item.name} - {item.name}</option>)}
                    </select>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="packageNo">Package no</label><input id="packageNo" name="packageNo" /></div>
                    <div className="field"><label htmlFor="marksAndNumbers">Marks</label><input id="marksAndNumbers" name="marksAndNumbers" /></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="sku">SKU</label><input id="sku" name="sku" /></div>
                    <div className="field"><label htmlFor="hsnSac">HSN/SAC</label><input id="hsnSac" name="hsnSac" /></div>
                  </div>
                  <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" required /></div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" step="0.0001" min="0" required /></div>
                    <div className="field"><label htmlFor="unitCode">Unit</label><input id="unitCode" name="unitCode" /></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label htmlFor="netWeightKg">Net KG</label><input id="netWeightKg" name="netWeightKg" type="number" step="0.0001" min="0" defaultValue="0" /></div>
                    <div className="field"><label htmlFor="grossWeightKg">Gross KG</label><input id="grossWeightKg" name="grossWeightKg" type="number" step="0.0001" min="0" defaultValue="0" /></div>
                  </div>
                  <div className="form-grid three">
                    <div className="field"><label htmlFor="lengthCm">L cm</label><input id="lengthCm" name="lengthCm" type="number" step="0.0001" min="0" /></div>
                    <div className="field"><label htmlFor="widthCm">W cm</label><input id="widthCm" name="widthCm" type="number" step="0.0001" min="0" /></div>
                    <div className="field"><label htmlFor="heightCm">H cm</label><input id="heightCm" name="heightCm" type="number" step="0.0001" min="0" /></div>
                  </div>
                  <button className="button" type="submit">Add line</button>
                </form>
              </details>
            ) : null}
          </section>
        </main>
      </div>
    </AppShell>
  );
}

function PackingListDocumentFields({
  packingList,
  workspace
}: {
  packingList: NonNullable<Awaited<ReturnType<typeof getPackingList>>>;
  workspace: Awaited<ReturnType<typeof getPackingListWorkspace>>;
}) {
  return (
    <div className="document-grid">
      <div className="doc-field span-2 tall">
        <label>Exporter</label>
        <select name="companyId" defaultValue={packingList.companyId || ""}>
          <option value="">Select exporter</option>
          {workspace.companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}
        </select>
        <p>{packingList.company?.addressLine1 || "-"}</p>
        <p>{packingList.company?.city || ""}{packingList.company?.state ? `, ${packingList.company.state}` : ""}</p>
        <p>{packingList.company?.gstin ? `GST: ${packingList.company.gstin}` : ""}</p>
      </div>
      <div className="doc-field">
        <label htmlFor="packingListDate">Packing List Number & Date</label>
        <div className="inline-doc-fields">
          <strong>{packingList.packingListNumber || "Draft"}</strong>
          <input id="packingListDate" name="packingListDate" type="date" defaultValue={packingList.packingListDate.toISOString().slice(0, 10)} required />
        </div>
      </div>
      <div className="doc-field">
        <label htmlFor="exportReference">Exporter Reference</label>
        <input id="exportReference" name="exportReference" defaultValue={packingList.exportReference || ""} />
      </div>
      <div className="doc-field">
        <label>Invoice Reference</label>
        <p>{packingList.invoice?.invoiceNumber || "-"}</p>
        <p>{packingList.invoice?.invoiceDate.toISOString().slice(0, 10) || ""}</p>
      </div>
      <div className="doc-field">
        <label htmlFor="consigneeBuyerId">Consignee (If Any)</label>
        <select id="consigneeBuyerId" name="consigneeBuyerId" defaultValue={packingList.consigneeBuyerId || ""}>
          <option value="">Same as buyer / none</option>
          {workspace.buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.displayName}</option>)}
        </select>
      </div>
      <div className="doc-field">
        <label htmlFor="buyerId">Buyer</label>
        <select id="buyerId" name="buyerId" defaultValue={packingList.buyerId || ""}>
          <option value="">Select buyer</option>
          {workspace.buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.displayName}</option>)}
        </select>
        <p>{packingList.buyer?.email || ""}</p>
      </div>
      <div className="doc-field">
        <label htmlFor="shipmentMode">Shipment Mode</label>
        <input id="shipmentMode" name="shipmentMode" defaultValue={packingList.shipmentMode || ""} placeholder="By road / Sea / Air" />
      </div>
      <div className="doc-field">
        <label htmlFor="containerNumber">Container & Seal</label>
        <div className="inline-doc-fields">
          <input id="containerNumber" name="containerNumber" defaultValue={packingList.containerNumber || ""} placeholder="Container no" />
          <input id="sealNumber" name="sealNumber" defaultValue={packingList.sealNumber || ""} placeholder="Seal no" />
        </div>
      </div>
      <div className="doc-field">
        <label htmlFor="portOfLoading">Port of Loading</label>
        <input id="portOfLoading" name="portOfLoading" defaultValue={packingList.portOfLoading || ""} />
      </div>
      <div className="doc-field">
        <label htmlFor="portOfDischarge">Port of Discharge</label>
        <input id="portOfDischarge" name="portOfDischarge" defaultValue={packingList.portOfDischarge || ""} />
      </div>
      <div className="doc-field">
        <label htmlFor="finalDestination">Country / Final Destination</label>
        <input id="finalDestination" name="finalDestination" defaultValue={packingList.finalDestination || ""} />
      </div>
      <div className="doc-field span-3">
        <label htmlFor="notes">Notes / Declaration</label>
        <textarea id="notes" name="notes" defaultValue={packingList.notes || ""} />
      </div>
    </div>
  );
}

function PackingListSnapshot({
  packingList
}: {
  packingList: NonNullable<Awaited<ReturnType<typeof getPackingList>>>;
}) {
  return (
    <div className="document-grid">
      <div className="doc-field span-2 tall">
        <label>Exporter</label>
        <strong>{packingList.company?.legalName || "-"}</strong>
        <p>{packingList.company?.addressLine1 || "-"}</p>
        <p>{packingList.company?.city || ""}{packingList.company?.state ? `, ${packingList.company.state}` : ""}</p>
        <p>{packingList.company?.gstin ? `GST: ${packingList.company.gstin}` : ""}</p>
      </div>
      <div className="doc-field"><label>Packing List Number & Date</label><p>{packingList.packingListNumber || "-"}</p><p>{packingList.packingListDate.toISOString().slice(0, 10)}</p></div>
      <div className="doc-field"><label>Exporter Reference</label><p>{packingList.exportReference || "-"}</p></div>
      <div className="doc-field"><label>Invoice Reference</label><p>{packingList.invoice?.invoiceNumber || "-"}</p></div>
      <div className="doc-field"><label>Consignee (If Any)</label><p>{packingList.consigneeBuyer?.displayName || "-"}</p></div>
      <div className="doc-field"><label>Buyer</label><p>{packingList.buyer?.displayName || "-"}</p></div>
      <div className="doc-field"><label>Shipment Mode</label><p>{packingList.shipmentMode || "-"}</p></div>
      <div className="doc-field"><label>Container & Seal</label><p>{packingList.containerNumber || "-"} / {packingList.sealNumber || "-"}</p></div>
      <div className="doc-field"><label>Port of Loading</label><p>{packingList.portOfLoading || "-"}</p></div>
      <div className="doc-field"><label>Port of Discharge</label><p>{packingList.portOfDischarge || "-"}</p></div>
      <div className="doc-field"><label>Country / Final Destination</label><p>{packingList.finalDestination || "-"}</p></div>
      <div className="doc-field span-3"><label>Notes / Declaration</label><p>{packingList.notes || "-"}</p></div>
    </div>
  );
}

function packingListReadiness(input: {
  hasCompany: boolean;
  hasBuyer: boolean;
  hasLines: boolean;
  hasShipmentMode: boolean;
  hasRoute: boolean;
  hasWeights: boolean;
}) {
  const items = [
    { label: "Exporter", done: input.hasCompany },
    { label: "Buyer", done: input.hasBuyer },
    { label: "Package lines", done: input.hasLines },
    { label: "Shipment mode", done: input.hasShipmentMode },
    { label: "Destination", done: input.hasRoute },
    { label: "Weights", done: input.hasWeights }
  ];

  return {
    items,
    ready: items.filter((item) => item.done).length,
    total: items.length
  };
}
