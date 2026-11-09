"use client";

import { useMemo, useState } from "react";
import { CATALOGUE_FIELDS, CATALOGUE_LAYOUTS, DEFAULT_CATALOGUE_FIELDS, type CatalogueFieldKey } from "@/lib/catalogue/catalogue-fields";

type Product = { id: string; name: string; sku: string | null; category: string | null; price: string | null; hasPhoto: boolean };
type Company = { id: string; legalName: string; tradingName: string | null };

export function CatalogueBuilder({ products, categories, companies }: { products: Product[]; categories: string[]; companies: Company[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<1 | 2 | 4>(4);
  const [fields, setFields] = useState<CatalogueFieldKey[]>(DEFAULT_CATALOGUE_FIELDS);
  const [title, setTitle] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) =>
      (!category || product.category === category) &&
      (!q || product.name.toLowerCase().includes(q) || (product.sku ?? "").toLowerCase().includes(q))
    );
  }, [products, query, category]);

  const selectedSet = new Set(selected);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const selectVisible = () => setSelected((current) => [...current, ...visible.map((product) => product.id).filter((id) => !current.includes(id))]);
  const clearSelection = () => setSelected([]);
  const toggleField = (key: CatalogueFieldKey) => setFields((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  const pages = selected.length ? Math.ceil(selected.length / layout) : 0;
  const withoutPhoto = selected.filter((id) => !products.find((product) => product.id === id)?.hasPhoto).length;
  const ready = selected.length > 0 && fields.length > 0;

  return (
    <form className="catalogue-builder" action="/api/catalogue/pdf" method="post">
      {selected.map((id) => <input key={id} type="hidden" name="itemIds" value={id} />)}
      <input type="hidden" name="layout" value={layout} />

      <section className="panel">
        <div className="catalogue-step"><span>1</span><div><h2>Choose products</h2><p className="muted">Tick the products to include. They appear in the order you tick them.</p></div></div>
        {products.length === 0 ? (
          <div className="empty-state">No active products yet. Add products with photos under Products first.</div>
        ) : (
          <>
            <div className="catalogue-filters">
              <input type="search" placeholder="Search name or code" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search products" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
                <option value="">All categories</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" className="button subtle" onClick={selectVisible}>Select all shown ({visible.length})</button>
              <button type="button" className="button subtle" onClick={clearSelection} disabled={!selected.length}>Clear</button>
            </div>
            <div className="catalogue-grid">
              {visible.map((product) => {
                const isOn = selectedSet.has(product.id);
                return (
                  <label key={product.id} className={`catalogue-card${isOn ? " selected" : ""}`}>
                    <input type="checkbox" checked={isOn} onChange={() => toggle(product.id)} />
                    <span className="catalogue-thumb">
                      {product.hasPhoto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={`/api/items/${product.id}/image`} alt="" loading="lazy" />
                        : <span className="muted">No photo</span>}
                    </span>
                    <strong>{product.name}</strong>
                    <span className="muted">{[product.sku, product.price].filter(Boolean).join(" · ") || " "}</span>
                    {isOn ? <span className="catalogue-order">{selected.indexOf(product.id) + 1}</span> : null}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="catalogue-step"><span>2</span><div><h2>Photos per page</h2></div></div>
        <div className="catalogue-layouts">
          {CATALOGUE_LAYOUTS.map((option) => (
            <label key={option.value} className={`catalogue-layout${layout === option.value ? " selected" : ""}`}>
              <input type="radio" name="layoutChoice" checked={layout === option.value} onChange={() => setLayout(option.value)} />
              <span className={`layout-preview per-${option.value}`} aria-hidden="true">
                {Array.from({ length: option.value }).map((_, index) => <i key={index} />)}
              </span>
              <strong>{option.label}</strong>
              <span className="muted">{option.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="catalogue-step"><span>3</span><div><h2>Details to print</h2><p className="muted">Only the ticked details are printed under each photo.</p></div></div>
        <div className="catalogue-fields">
          {CATALOGUE_FIELDS.map((field) => (
            <label key={field.key} className="checkbox">
              <input type="checkbox" name="fields" value={field.key} checked={fields.includes(field.key)} onChange={() => toggleField(field.key)} />
              {field.label}
            </label>
          ))}
        </div>
        {!fields.length ? <p className="notice error">Tick at least one detail.</p> : null}
      </section>

      <section className="panel">
        <div className="catalogue-step"><span>4</span><div><h2>Title and download</h2></div></div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="catalogue-title">Catalogue title</label>
            <input id="catalogue-title" name="title" maxLength={120} placeholder="e.g. Brass Collection 2026" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          {companies.length > 1 ? (
            <div className="field">
              <label htmlFor="catalogue-company">Company on the header</label>
              <select id="catalogue-company" name="companyId" defaultValue={companies[0]?.id}>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.tradingName || company.legalName}</option>)}
              </select>
            </div>
          ) : null}
        </div>
        <label className="checkbox"><input type="checkbox" name="showLogo" defaultChecked /> Show company logo</label>
        <div className="catalogue-summary">
          <span>{selected.length} product{selected.length === 1 ? "" : "s"} · {layout} per page · {pages} page{pages === 1 ? "" : "s"}</span>
          {withoutPhoto ? <span className="muted">{withoutPhoto} selected without a photo</span> : null}
          <button className="button" type="submit" disabled={!ready}>Download catalogue PDF</button>
        </div>
      </section>
    </form>
  );
}
