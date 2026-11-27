import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Download, Eye, PackagePlus, PencilLine, Save, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OwnerDeletePanel } from "@/components/owner-delete-panel";
import { getTwoFactorStatus } from "@/lib/auth/two-factor-service";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenantContextForUser } from "@/lib/organisations/membership";
import { hasPermission } from "@/lib/permissions/roles";
import { cartonRangeLabel, lineCartonCount } from "@/lib/packing-lists/calculation";
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
  const mayPurge = hasPermission(context.role, "data:purge");
  const twoFactorOn = mayPurge ? (await getTwoFactorStatus(user.id)).enabled : false;

  const canEdit = packingList.status === "draft";
  const nextCartonFrom = Math.max(0, ...packingList.lines.map((line) => line.cartonTo ?? line.cartonFrom ?? 0)) + 1;
  const isIssued = packingList.status === "issued";
  const isCancelled = packingList.status === "cancelled";
  const mayIssue = hasPermission(context.role, "invoices:issue");
  const mayCancel = hasPermission(context.role, "invoices:cancel");
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
              {isIssued && mayIssue ? (
                <form action="/api/packing-lists/reopen" method="post">
                  <input type="hidden" name="packingListId" value={packingList.id} />
                  <input type="hidden" name="expectedVersion" value={packingList.version} />
                  <button className="button subtle tiny" type="submit">
                    <PencilLine size={16} />
                    Edit
                  </button>
                </form>
              ) : null}
              {canEdit ? (
                <a className="button subtle tiny" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer">
                  <Eye size={16} />
                  Preview PDF
                </a>
              ) : (
                <a className="button tiny" href={`/api/packing-lists/${packingList.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download size={16} />
                  Download PDF
                </a>
              )}
            </div>
          </div>

          <section className="document-canvas">
            <div className="document-title-row">
              <h1>PACKING LIST</h1>
              <span>Page 1 of 1</span>
            </div>

            {isCancelled ? (
              <p className="notice error">This packing list is cancelled. Its number {packingList.packingListNumber} stays used and will not be issued again.</p>
            ) : null}
            {canEdit && packingList.packingListNumber ? (
              <p className="notice">Open for editing. It keeps number {packingList.packingListNumber}; finalise it again to update the PDF.</p>
            ) : null}

            <div className="document-command-panel compact">
              <div>
                <p className="muted">{canEdit ? "Before you finalise" : isCancelled ? "Cancelled" : "Finalised"}</p>
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
              {!packingList.packingListNumber ? (
                <details className="details compact">
                  <summary><Trash2 size={15} /> Delete draft</summary>
                  <form className="form compact-form" action="/api/packing-lists/delete" method="post">
                    <input type="hidden" name="packingListId" value={packingList.id} />
                    <input type="hidden" name="expectedVersion" value={packingList.version} />
                    <p className="muted">This removes the draft and all its package lines. It cannot be undone.</p>
                    <button className="button danger" type="submit">Delete permanently</button>
                  </form>
                </details>
              ) : null}
            </div>
            ) : null}

            {isIssued && mayCancel ? (
              <details className="details top-space">
                <summary><Ban size={16} /> Cancel packing list</summary>
                <form className="form top-space" action="/api/packing-lists/cancel" method="post">
                  <input type="hidden" name="packingListId" value={packingList.id} />
                  <input type="hidden" name="expectedVersion" value={packingList.version} />
                  <div className="field">
                    <label htmlFor="cancelReason">Reason</label>
                    <textarea id="cancelReason" name="reason" required maxLength={500} />
                  </div>
                  <button className="button danger" type="submit">Cancel packing list</button>
                </form>
              </details>
            ) : null}

            <section className="document-lines">
              <div className="document-section-heading">
                <h2>Cartons</h2>
                <span className="badge neutral">{packingList.lines.length} lines</span>
              </div>
              {packingList.lines.length === 0 ? (
                <div className="empty-state">No cartons yet. Add carton rows before issuing.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>CTN no.</th>
                        <th>Item no.</th>
                        <th>Description</th>
                        <th>Pcs</th>
                        <th>Net kg</th>
                        <th>Gross kg</th>
                        <th>CBM</th>
                        {canEdit ? <th>Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {packingList.lines.map((line) => {
                        const cartons = lineCartonCount(line);
                        return (
                        <tr key={line.id}>
                          <td>
                            <strong>{cartonRangeLabel(line) || line.sortOrder}</strong>
                            <p className="muted">{cartons} {cartons === 1 ? "CTN" : "CTNS"}{line.marksAndNumbers ? ` · ${line.marksAndNumbers}` : ""}</p>
                          </td>
                          <td>
                            {line.sku || "-"}
                            <p className="muted">{line.hsnSac ? `HSN ${line.hsnSac}` : ""}</p>
                          </td>
                          <td>
                            {line.description}
                            <p className="muted">
                              {[
                                line.piecesPerCarton ? `${line.piecesPerCarton.toString()} ${line.unitCode || "pcs"}/CTN` : "",
                                line.netWeightPerPieceKg ? `${line.netWeightPerPieceKg.toString()} kg net/pc` : "",
                                line.grossWeightPerCartonKg ? `${line.grossWeightPerCartonKg.toString()} kg gross/CTN` : "",
                                line.lengthCm && line.widthCm && line.heightCm ? `${line.lengthCm.toString()} × ${line.widthCm.toString()} × ${line.heightCm.toString()} cm` : ""
                              ].filter(Boolean).join(" · ")}
                            </p>
                          </td>
                          <td>{line.quantity.toString()} {line.unitCode || ""}</td>
                          <td>{line.netWeightKg.toString()}</td>
                          <td>{line.grossWeightKg.toString()}</td>
                          <td>{line.volumeCbm.toString()}</td>
                          {canEdit ? (
                            <td>
                              <div className="line-actions">
                                <details className="details compact">
                                  <summary>Edit</summary>
                                  <form className="form compact-form" action="/api/packing-lists/lines/update" method="post">
                                    <input type="hidden" name="packingListId" value={packingList.id} />
                                    <input type="hidden" name="lineId" value={line.id} />
                                    <input type="hidden" name="expectedVersion" value={packingList.version} />
                                    <CartonLineFields idPrefix={line.id} line={line} />
                                    <button className="button" type="submit">Save line</button>
                                  </form>
                                </details>
                                <form action="/api/packing-lists/lines/delete" method="post">
                                  <input type="hidden" name="packingListId" value={packingList.id} />
                                  <input type="hidden" name="lineId" value={line.id} />
                                  <input type="hidden" name="expectedVersion" value={packingList.version} />
                                  <button className="icon-button danger" title="Delete packing line" type="submit"><Trash2 size={16} /></button>
                                </form>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <details className="details top-space document-preview" open={!canEdit}>
              <summary><Eye size={16} /> {canEdit ? "Draft preview (save changes first to see them here)" : "PDF preview"}</summary>
              <iframe
                className="pdf-preview-frame"
                src={`/api/packing-lists/${packingList.id}/pdf?v=${packingList.version}#view=FitH`}
                title="Packing list PDF preview"
                loading="lazy"
              />
            </details>

            {canEdit ? (
              <details className="details top-space">
                <summary><PackagePlus size={16} /> Add cartons</summary>
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
                  <CartonLineFields idPrefix="new" nextCartonFrom={nextCartonFrom} />
                  <button className="button" type="submit">Add cartons</button>
                </form>
              </details>
            ) : null}
          </section>
        </main>
      </div>
      {mayPurge ? (
        <OwnerDeletePanel
          entity="packing_list"
          id={packingList.id}
          label={packingList.packingListNumber || "this draft packing list"}
          twoFactorOn={twoFactorOn}
          consequences="All its carton lines are deleted too."
        />
      ) : null}
    </AppShell>
  );
}

type PackingLine = NonNullable<Awaited<ReturnType<typeof getPackingList>>>["lines"][number];

/**
 * Carton-wise line inputs shared by "Add cartons" and each row's Edit form. Pcs, net and gross totals are
 * worked out from pcs/CTN, net kg per piece and gross kg per carton; the totals box is only for rows
 * that are not packed carton-wise.
 */
function CartonLineFields({ idPrefix, line, nextCartonFrom }: { idPrefix: string; line?: PackingLine; nextCartonFrom?: number }) {
  const id = (name: string) => `${name}-${idPrefix}`;
  const str = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? "" : value.toString());
  const hasPerUnit = Boolean(line?.piecesPerCarton || line?.netWeightPerPieceKg || line?.grossWeightPerCartonKg);
  return (
    <>
      {line ? <input type="hidden" name="sortOrder" value={line.sortOrder} /> : null}
      <div className="form-grid three">
        <div className="field"><label htmlFor={id("from")}>CTN no. from</label><input id={id("from")} name="cartonFrom" type="number" min="1" step="1" defaultValue={line ? str(line.cartonFrom) : String(nextCartonFrom ?? 1)} /></div>
        <div className="field"><label htmlFor={id("to")}>CTN no. to</label><input id={id("to")} name="cartonTo" type="number" min="1" step="1" defaultValue={str(line?.cartonTo)} placeholder="same" /></div>
        <div className="field"><label htmlFor={id("sku")}>Item no.</label><input id={id("sku")} name="sku" defaultValue={line?.sku || ""} /></div>
      </div>
      <div className="field"><label htmlFor={id("description")}>Description of goods</label><textarea id={id("description")} name="description" required defaultValue={line?.description || ""} /></div>
      <div className="form-grid three">
        <div className="field"><label htmlFor={id("pcs")}>Pcs / CTN</label><input id={id("pcs")} name="piecesPerCarton" type="number" step="0.0001" min="0" defaultValue={str(line?.piecesPerCarton)} /></div>
        <div className="field"><label htmlFor={id("netpc")}>Net kg / pc</label><input id={id("netpc")} name="netWeightPerPieceKg" type="number" step="0.000001" min="0" defaultValue={str(line?.netWeightPerPieceKg)} /></div>
        <div className="field"><label htmlFor={id("grossctn")}>Gross kg / CTN</label><input id={id("grossctn")} name="grossWeightPerCartonKg" type="number" step="0.0001" min="0" defaultValue={str(line?.grossWeightPerCartonKg)} /></div>
      </div>
      <div className="form-grid three">
        <div className="field"><label htmlFor={id("l")}>CTN L cm</label><input id={id("l")} name="lengthCm" type="number" step="0.0001" min="0" defaultValue={str(line?.lengthCm)} /></div>
        <div className="field"><label htmlFor={id("w")}>CTN W cm</label><input id={id("w")} name="widthCm" type="number" step="0.0001" min="0" defaultValue={str(line?.widthCm)} /></div>
        <div className="field"><label htmlFor={id("h")}>CTN H cm</label><input id={id("h")} name="heightCm" type="number" step="0.0001" min="0" defaultValue={str(line?.heightCm)} /></div>
      </div>
      <div className="form-grid three">
        <div className="field"><label htmlFor={id("unit")}>Unit</label><input id={id("unit")} name="unitCode" defaultValue={line?.unitCode || ""} placeholder="PCS" /></div>
        <div className="field"><label htmlFor={id("hsn")}>HSN</label><input id={id("hsn")} name="hsnSac" defaultValue={line?.hsnSac || ""} /></div>
        <div className="field"><label htmlFor={id("marks")}>Marks</label><input id={id("marks")} name="marksAndNumbers" defaultValue={line?.marksAndNumbers || ""} /></div>
      </div>
      <details className="details compact" open={Boolean(line && !hasPerUnit)}>
        <summary>Totals instead (only for rows not packed carton-wise)</summary>
        <div className="form-grid three">
          <div className="field"><label htmlFor={id("qty")}>Total pcs</label><input id={id("qty")} name="quantity" type="number" step="0.0001" min="0" defaultValue={line && !line.piecesPerCarton ? str(line.quantity) : ""} /></div>
          <div className="field"><label htmlFor={id("net")}>Total net kg</label><input id={id("net")} name="netWeightKg" type="number" step="0.0001" min="0" defaultValue={line && !line.netWeightPerPieceKg ? str(line.netWeightKg) : ""} /></div>
          <div className="field"><label htmlFor={id("gross")}>Total gross kg</label><input id={id("gross")} name="grossWeightKg" type="number" step="0.0001" min="0" defaultValue={line && !line.grossWeightPerCartonKg ? str(line.grossWeightKg) : ""} /></div>
        </div>
      </details>
    </>
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
        <label htmlFor="finalDestination">Port of Final Destination</label>
        <input id="finalDestination" name="finalDestination" defaultValue={packingList.finalDestination || ""} />
      </div>
      <div className="doc-field">
        <label htmlFor="buyerOrderNumber">Buyer&apos;s Order No. & Date</label>
        <div className="inline-doc-fields">
          <input id="buyerOrderNumber" name="buyerOrderNumber" defaultValue={packingList.buyerOrderNumber || ""} placeholder="Order no" />
          <input id="buyerOrderDate" name="buyerOrderDate" type="date" defaultValue={packingList.buyerOrderDate?.toISOString().slice(0, 10) || ""} />
        </div>
      </div>
      <div className="doc-field">
        <label htmlFor="preCarriageBy">Pre-Carriage by</label>
        <input id="preCarriageBy" name="preCarriageBy" defaultValue={packingList.preCarriageBy || ""} placeholder="Transport" />
      </div>
      <div className="doc-field">
        <label htmlFor="placeOfReceipt">Place of Receipt by Pre-Carrier</label>
        <input id="placeOfReceipt" name="placeOfReceipt" defaultValue={packingList.placeOfReceipt || ""} />
      </div>
      <div className="doc-field">
        <label htmlFor="vesselFlightNo">Vessel / Flight No.</label>
        <input id="vesselFlightNo" name="vesselFlightNo" defaultValue={packingList.vesselFlightNo || ""} />
      </div>
      <div className="doc-field">
        <label htmlFor="countryOfOrigin">Country of Origin</label>
        <input id="countryOfOrigin" name="countryOfOrigin" defaultValue={packingList.countryOfOrigin || "India"} />
      </div>
      <div className="doc-field">
        <label htmlFor="countryOfFinalDestination">Country of Final Destination</label>
        <input id="countryOfFinalDestination" name="countryOfFinalDestination" defaultValue={packingList.countryOfFinalDestination || ""} />
      </div>
      <div className="doc-field span-3">
        <label htmlFor="termsOfDelivery">Terms of Delivery and Payment</label>
        <textarea id="termsOfDelivery" name="termsOfDelivery" defaultValue={packingList.termsOfDelivery || ""} />
      </div>
      <div className="doc-field span-3">
        <label htmlFor="notes">Declaration (blank = standard declaration)</label>
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
      <div className="doc-field"><label>Port of Final Destination</label><p>{packingList.finalDestination || "-"}</p></div>
      <div className="doc-field"><label>Buyer&apos;s Order No. & Date</label><p>{packingList.buyerOrderNumber || "-"}</p><p>{packingList.buyerOrderDate?.toISOString().slice(0, 10) || ""}</p></div>
      <div className="doc-field"><label>Pre-Carriage by / Place of Receipt</label><p>{packingList.preCarriageBy || "-"} / {packingList.placeOfReceipt || "-"}</p></div>
      <div className="doc-field"><label>Vessel / Flight No.</label><p>{packingList.vesselFlightNo || "-"}</p></div>
      <div className="doc-field"><label>Country of Origin / Final Destination</label><p>{packingList.countryOfOrigin || "-"} / {packingList.countryOfFinalDestination || "-"}</p></div>
      <div className="doc-field span-3"><label>Terms of Delivery and Payment</label><p>{packingList.termsOfDelivery || "-"}</p></div>
      <div className="doc-field span-3"><label>Declaration</label><p>{packingList.notes || "Standard declaration"}</p></div>
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
