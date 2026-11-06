/** Details a user can tick to print under each product photo in a catalogue PDF. */
export const CATALOGUE_FIELDS = [
  { key: "name", label: "Product name" },
  { key: "sku", label: "Code / SKU" },
  { key: "price", label: "Price" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Sub-category" },
  { key: "description", label: "Description" },
  { key: "hsnSac", label: "HSN code" },
  { key: "unit", label: "Unit" },
  { key: "weightKg", label: "Weight (kg)" },
  { key: "manufacturer", label: "Maker / material" },
  { key: "barcode", label: "Barcode" }
] as const;

export type CatalogueFieldKey = typeof CATALOGUE_FIELDS[number]["key"];

export const CATALOGUE_LAYOUTS = [
  { value: 1, label: "1 photo per page", hint: "Large photo, best for hero products" },
  { value: 2, label: "2 photos per page", hint: "Balanced photo and details" },
  { value: 4, label: "4 photos per page", hint: "Compact range overview" }
] as const;

export type CatalogueLayout = 1 | 2 | 4;

export const DEFAULT_CATALOGUE_FIELDS: CatalogueFieldKey[] = ["name", "sku", "price"];
