import { redirect } from "next/navigation";
import {
  Box,
  Calculator,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Grid2X2,
  ImagePlus,
  Layers3,
  List,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Wrench
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BULK_ITEMS_FORM_ID, DeleteItemButton, DeleteSelectedButton, SelectAllItemsCheckbox } from "@/components/items/item-selection";
import { ProductImageUploader } from "@/components/items/product-image-uploader";
import { getCurrentUser } from "@/lib/auth/session";
import { listItemMasters } from "@/lib/items/item-service";
import { getTenantContextForUser } from "@/lib/organisations/membership";

type ItemMasterData = Awaited<ReturnType<typeof listItemMasters>>;
type ItemForForm = ItemMasterData["items"][number];
type UnitForForm = ItemMasterData["units"][number];
type TaxRateForForm = ItemMasterData["taxRates"][number];

export default async function ItemsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; category?: string; status?: string; sort?: string; error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getTenantContextForUser(user.id);

  if (!context) {
    redirect("/register");
  }

  const filters = await searchParams;
  const { units, taxRates, items, categories, subcategories } = await listItemMasters(context, filters);
  const query = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const exportHref = `/api/items/export${query.size ? `?${query.toString()}` : ""}`;
  const activeCount = items.filter((item) => item.isActive).length;
  const pendingImageCount = items.filter((item) => !item.imageAssetId || item.imageStatus !== "linked").length;
  const dataQuality = [
    { label: "Missing item code", count: items.filter((item) => !item.sku).length },
    { label: "Missing HSN", count: items.filter((item) => !item.hsnSac).length },
    { label: "Missing price", count: items.filter((item) => !item.saleRate).length },
    { label: "Missing weight", count: items.filter((item) => !item.weightKg).length },
    { label: "Image pending", count: pendingImageCount }
  ];

  return (
    <AppShell>
      <div className="items-workspace">
        <main className="exports-main">
          <header className="exports-topbar">
            <div>
              <h1>Products ({items.length})</h1>
              <p className="muted">Images, item codes, categories, prices, weights, barcodes, and export document readiness.</p>
            </div>
            <div className="item-toolbar">
              <details className="toolbar-popover">
                <summary className="button subtle"><FileSpreadsheet size={16} /> Import Excel</summary>
                <ImportPanel />
              </details>
              <details className="toolbar-popover">
                <summary className="button subtle"><ImagePlus size={16} /> Bulk Images</summary>
                <BulkImagePanel />
              </details>
              <details className="toolbar-popover">
                <summary className="button subtle"><Wrench size={16} /> Fix Images</summary>
                <ToolPanel title="Image Repair Queue" icon={<Wrench size={26} />} description="Review items missing images, duplicated image references, or filenames that do not match item codes." />
              </details>
              <details className="toolbar-popover">
                <summary className="button subtle"><Calculator size={16} /> Order Qty Analyzer</summary>
                <ToolPanel title="Order Quantity Analyzer" icon={<Calculator size={26} />} description="Reserved for comparing invoice quantities against cartons, units, and package dimensions." />
              </details>
              <DeleteSelectedButton />
              <details className="toolbar-menu">
                <summary className="button subtle"><Download size={16} /> Export</summary>
                <div className="menu-card">
                  <a href={exportHref}><FileSpreadsheet size={15} /> Export Excel</a>
                  <a href={exportHref}><Download size={15} /> Export PDF</a>
                </div>
              </details>
              <a className="button" href="#add-item"><Plus size={16} /> Add Item</a>
            </div>
          </header>

          <section className="items-board">
            <div className="items-board-header">
              <form className="items-filterbar" method="get">
                <label className="compact-select">
                  <span className="sr-only">Category</span>
                  <select name="category" defaultValue={filters?.category || ""}>
                    <option value="">All Categories</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label className="search-pill">
                  <Search size={16} />
                  <input name="q" defaultValue={filters?.q || ""} placeholder="Search by name, SKU, HSN, barcode" />
                </label>
                <label className="compact-select">
                  <span className="sr-only">Sort</span>
                  <select name="sort" defaultValue={filters?.sort || "newest"}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="code">Item Code</option>
                    <option value="price">Highest Price</option>
                  </select>
                </label>
                <label className="compact-select">
                  <span className="sr-only">Status</span>
                  <select name="status" defaultValue={filters?.status || ""}>
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <button className="button subtle tiny" type="submit">Apply</button>
              </form>
              <div className="view-switcher" aria-label="Catalog view options">
                <button className="active" type="button" title="List view"><List size={16} /></button>
                <button type="button" title="Grid view" disabled><Grid2X2 size={16} /></button>
              </div>
            </div>

            <div className="mini-stats">
              <span><strong>{activeCount}</strong> active</span>
              <span><strong>{pendingImageCount}</strong> image pending</span>
              <span><strong>{categories.length}</strong> categories</span>
            </div>

            <div className="catalog-quality-strip">
              {dataQuality.map((metric) => (
                <span className={metric.count > 0 ? "quality-pill warning" : "quality-pill"} key={metric.label}>
                  <strong>{metric.count}</strong>
                  {metric.label}
                </span>
              ))}
            </div>

            {items.length === 0 ? (
              <div className="empty-state">No items match this view. Add your first catalog item or clear filters.</div>
            ) : (
              <div className="table-wrap">
                <table className="table exdocs-items-table">
                  <thead>
                    <tr>
                      <th><SelectAllItemsCheckbox /></th>
                      <th>Image</th>
                      <th>Item Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Weight</th>
                      <th>Status</th>
                      <th>Barcode</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td><input aria-label={`Select ${item.sku || item.name}`} type="checkbox" name="itemIds" value={item.id} form={BULK_ITEMS_FORM_ID} /></td>
                        <td><ItemThumb item={item} /></td>
                        <td><strong>{item.sku || "Uncoded"}</strong></td>
                        <td>
                          <div className="item-name-cell">
                            <strong>{item.name}</strong>
                            <span>{item.description || item.manufacturer || "No description added"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="soft-chip">{item.category || "Uncategorised"}</span>
                          {item.subcategory ? <span className="muted small-line">{item.subcategory}</span> : null}
                        </td>
                        <td>{item.saleRate ? `${item.currency} ${Number(item.saleRate.toString()).toLocaleString("en-IN")}` : "-"}</td>
                        <td>{item.weightKg ? `${Number(item.weightKg.toString())} kg` : "-"}</td>
                        <td>
                          <form action="/api/items/toggle-active" method="post">
                            <input type="hidden" name="itemId" value={item.id} />
                            <button className={`toggle-pill ${item.isActive ? "on" : ""}`} type="submit">
                              <span />
                              {item.isActive ? "Active" : "Inactive"}
                            </button>
                          </form>
                        </td>
                        <td><span className={item.barcode ? "badge success" : "badge neutral"}>{item.barcode ? "Ready" : "Pending"}</span></td>
                        <td>
                          <div className="icon-row">
                            <details className="item-editor">
                              <summary className="icon-button" title="View and edit product"><Pencil size={16} /></summary>
                              <ItemEditor item={item} units={units} taxRates={taxRates} categories={categories} subcategories={subcategories} mode="edit" />
                            </details>
                            <form action="/api/items/duplicate" method="post">
                              <input type="hidden" name="itemId" value={item.id} />
                              <button className="icon-button" title="Duplicate item" type="submit"><Copy size={16} /></button>
                            </form>
                            <form action="/api/items/delete" method="post">
                              <input type="hidden" name="itemId" value={item.id} />
                              <DeleteItemButton label={item.sku || item.name} />
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="add-item-drawer" id="add-item">
            <summary><PackagePlus size={18} /> Add New Item</summary>
            <ItemEditor units={units} taxRates={taxRates} categories={categories} subcategories={subcategories} mode="create" />
          </details>
        </main>
      </div>
      <form id={BULK_ITEMS_FORM_ID} action="/api/items/delete/bulk" method="post" hidden />
    </AppShell>
  );
}

function ItemThumb({ item }: { item: ItemForForm }) {
  const label = (item.sku || item.name).slice(0, 2).toUpperCase();

  return (
    <div className={`item-thumb ${item.imageAssetId ? "ready" : ""}`}>
      {item.imageAssetId ? <img alt={item.name} src={`/api/items/${item.id}/image`} /> : label}
    </div>
  );
}

function ItemEditor({
  item,
  mode,
  categories,
  subcategories,
  taxRates,
  units
}: {
  item?: ItemForForm;
  mode: "create" | "edit";
  categories: string[];
  subcategories: string[];
  units: UnitForForm[];
  taxRates: TaxRateForForm[];
}) {
  return (
    <div className="item-editor-panel">
      <div className="item-editor-top">
        <div>
          <a className="button subtle tiny" href="/items">Back to List</a>
          <strong>{mode === "edit" ? `Edit Item: ${item?.sku || item?.name}` : "Add Item"}</strong>
        </div>
        <div className="toolbar">
          <button className="button subtle tiny" type="reset" form={`item-form-${item?.id || "new"}`}>Reset</button>
        </div>
      </div>

      <div className="item-editor-grid">
        <form
          id={`item-form-${item?.id || "new"}`}
          className="form item-detail-form"
          action={mode === "edit" ? "/api/items/update" : "/api/items"}
          method="post"
        >
          {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
          <section className="form-card open">
            <h3><FileSpreadsheet size={17} /> Basic Details</h3>
            <ItemFields item={item} units={units} taxRates={taxRates} categories={categories} subcategories={subcategories} />
          </section>
          <section className="form-card open">
            <h3><Box size={17} /> Size, Weight &amp; Packing</h3>
            <PackingFields item={item} />
          </section>
          <section className="form-card open">
            <h3><Tags size={17} /> Material &amp; Origin</h3>
            <MaterialFields item={item} />
          </section>
          <button className="button" type="submit">{mode === "edit" ? "Update Item" : "Save Item"}</button>
        </form>

        <aside className="item-image-panel">
          <h3>Product Images</h3>
          {item ? <ItemThumb item={item} /> : <div className="item-thumb">NE</div>}
          {item?.imageAssetId ? <a className="button subtle tiny" href={`/api/items/${item.id}/image`} target="_blank" rel="noreferrer"><Eye size={15} /> View full image</a> : null}
          {item ? (
            <ProductImageUploader itemId={item.id} itemCode={item.sku || ""} hasImage={Boolean(item.imageAssetId)} />
          ) : (
            <div className="upload-drop">
              <ImagePlus size={28} />
              <strong>Save item first</strong>
              <span>Image upload is available after the item is created.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ItemFields({
  item,
  categories,
  subcategories,
  units,
  taxRates
}: {
  item?: ItemForForm;
  categories: string[];
  subcategories: string[];
  units: UnitForForm[];
  taxRates: TaxRateForForm[];
}) {
  const suffix = item ? `-${item.id}` : "-new";

  return (
    <>
      <div className="form-grid two">
        <div className="field">
          <label htmlFor={`category${suffix}`}>Product Category</label>
          <input id={`category${suffix}`} name="category" list={`item-category-options${suffix}`} defaultValue={item?.category || ""} placeholder="Jewellery" />
        </div>
        <div className="field">
          <label htmlFor={`subcategory${suffix}`}>Subcategory</label>
          <input id={`subcategory${suffix}`} name="subcategory" list={`item-subcategory-options${suffix}`} defaultValue={item?.subcategory || ""} placeholder="Necklaces" />
        </div>
      </div>
      <datalist id={`item-category-options${suffix}`}>
        {categories.map((category) => <option key={category} value={category} />)}
      </datalist>
      <datalist id={`item-subcategory-options${suffix}`}>
        {subcategories.map((subcategory) => <option key={subcategory} value={subcategory} />)}
      </datalist>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor={`sku${suffix}`}>Item Code / SKU</label>
          <input id={`sku${suffix}`} name="sku" defaultValue={item?.sku || ""} placeholder="IND-0001" />
        </div>
        <div className="field">
          <label htmlFor={`hsnSac${suffix}`}>HSN Code</label>
          <input id={`hsnSac${suffix}`} name="hsnSac" defaultValue={item?.hsnSac || ""} placeholder="7113" />
        </div>
        <div className="field">
          <label htmlFor={`manufacturer${suffix}`}>Manufacturer</label>
          <input id={`manufacturer${suffix}`} name="manufacturer" defaultValue={item?.manufacturer || ""} placeholder="e.g., ABC Industries" />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`itemName${suffix}`}>Name *</label>
        <input id={`itemName${suffix}`} name="name" defaultValue={item?.name || ""} placeholder="Product display name" required />
      </div>
      <div className="field">
        <label htmlFor={`description${suffix}`}>Description</label>
        <textarea id={`description${suffix}`} name="description" defaultValue={item?.description || ""} placeholder="Detailed product description..." />
      </div>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor={`saleRate${suffix}`}>Unit Price</label>
          <input id={`saleRate${suffix}`} name="saleRate" type="number" min="0" step="0.0001" defaultValue={item?.saleRate?.toString() || ""} placeholder="0" />
        </div>
        <div className="field">
          <label htmlFor={`currency${suffix}`}>Currency</label>
          <input id={`currency${suffix}`} name="currency" defaultValue={item?.currency || "INR"} maxLength={3} required />
        </div>
        <div className="field">
          <label htmlFor={`unitId${suffix}`}>Unit</label>
          <select id={`unitId${suffix}`} name="unitId" defaultValue={item?.unitId || ""}>
            <option value="">PCS</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-grid three">
        <div className="field">
          <label htmlFor={`taxRateId${suffix}`}>Tax rate</label>
          <select id={`taxRateId${suffix}`} name="taxRateId" defaultValue={item?.taxRateId || ""}>
            <option value="">None</option>
            {taxRates.map((taxRate) => (
              <option key={taxRate.id} value={taxRate.id}>{taxRate.name} - {taxRate.rate.toString()}%</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`barcode${suffix}`}>Barcode / EAN</label>
          <input id={`barcode${suffix}`} name="barcode" defaultValue={item?.barcode || ""} />
        </div>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="isActive" value="true" defaultChecked={item?.isActive ?? true} />
        Active item
      </label>
    </>
  );
}

function ImportPanel() {
  return (
    <div className="floating-panel import-panel">
      <h2><FileSpreadsheet size={18} /> Excel Import - Phase 1</h2>
      <div className="modal-title">
        <strong>Import Items from Excel/CSV</strong>
        <span>Upload your product catalog to quickly add multiple items.</span>
      </div>
      <div className="template-callout">
        <div>
          <strong>Download Template</strong>
          <span>Get the Excel template with sample data</span>
        </div>
        <a className="button subtle" href="/api/items/template"><Download size={15} /> Template</a>
      </div>
      <div className="upload-zone">
        <Upload size={30} />
        <h3>Upload Excel or CSV file</h3>
        <p className="muted">Supports .xlsx, .xls, and .csv files up to 10MB. Backend import approval is reserved for the next phase.</p>
        <button className="button subtle" type="button"><Upload size={15} /> Choose File</button>
      </div>
    </div>
  );
}

function BulkImagePanel() {
  return (
    <div className="floating-panel image-panel">
      <h2><ImagePlus size={18} /> Bulk Image Upload - Phase 2</h2>
      <div className="modal-title">
        <strong>Bulk Image Upload</strong>
        <span>Upload multiple product images and link them to your items.</span>
      </div>
      <div className="tips-box">
        <strong>Pro Tips</strong>
        <span>Name your images with item codes for auto-matching, for example IND-0001.jpg.</span>
        <span>Supported formats: JPEG, PNG, GIF, WebP, max 10MB each.</span>
        <span>You can upload multiple images per item.</span>
      </div>
      <form className="upload-zone" action="/api/items/images/bulk" method="post" encType="multipart/form-data">
        <ImagePlus size={34} />
        <h3>Upload Product Images</h3>
        <p className="muted">Drag and drop multiple images or click to browse.</p>
        <input name="files" type="file" accept="image/png,image/jpeg,image/webp" multiple required />
        <button className="button subtle" type="submit"><Upload size={15} /> Upload Images</button>
      </form>
    </div>
  );
}

function ToolPanel({ description, icon, title }: { description: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="floating-panel compact-floating">
      {icon}
      <h2>{title}</h2>
      <p className="muted">{description}</p>
    </div>
  );
}

function NumberField({ id, label, name, step = "0.01", value, placeholder }: { id: string; label: string; name: string; step?: string; value?: { toString(): string } | number | null; placeholder?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="number" min="0" step={step} defaultValue={value == null ? "" : Number(value.toString())} placeholder={placeholder} />
    </div>
  );
}

function PackingFields({ item }: { item?: ItemForForm }) {
  const suffix = item ? `-${item.id}` : "-new";
  return (
    <>
      <div className="form-grid three">
        <NumberField id={`lengthCm${suffix}`} label="Length (cm)" name="lengthCm" value={item?.lengthCm} />
        <NumberField id={`widthCm${suffix}`} label="Width (cm)" name="widthCm" value={item?.widthCm} />
        <NumberField id={`heightCm${suffix}`} label="Height (cm)" name="heightCm" value={item?.heightCm} />
      </div>
      <div className="form-grid two">
        <NumberField id={`weightKg${suffix}`} label="Net weight per piece (kg)" name="weightKg" step="0.0001" value={item?.weightKg} />
        <NumberField id={`grossWeightKg${suffix}`} label="Gross weight per piece (kg)" name="grossWeightKg" step="0.0001" value={item?.grossWeightKg} />
      </div>
      <div className="form-grid two">
        <NumberField id={`unitsPerCarton${suffix}`} label="Pieces per carton" name="unitsPerCarton" step="1" value={item?.unitsPerCarton} />
        <NumberField id={`moq${suffix}`} label="Minimum order qty (MOQ)" name="moq" step="1" value={item?.moq} />
      </div>
    </>
  );
}

function MaterialFields({ item }: { item?: ItemForForm }) {
  const suffix = item ? `-${item.id}` : "-new";
  return (
    <div className="form-grid three">
      <div className="field">
        <label htmlFor={`material${suffix}`}>Material</label>
        <input id={`material${suffix}`} name="material" defaultValue={item?.material || ""} placeholder="Brass, Copper, Wood…" />
      </div>
      <div className="field">
        <label htmlFor={`finish${suffix}`}>Colour / Finish</label>
        <input id={`finish${suffix}`} name="finish" defaultValue={item?.finish || ""} placeholder="Antique gold, laser print…" />
      </div>
      <div className="field">
        <label htmlFor={`countryOfOrigin${suffix}`}>Country of origin</label>
        <input id={`countryOfOrigin${suffix}`} name="countryOfOrigin" defaultValue={item?.countryOfOrigin || (item ? "" : "India")} />
      </div>
    </div>
  );
}
