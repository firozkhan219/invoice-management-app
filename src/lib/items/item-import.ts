import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";

/**
 * Imports products from spreadsheet rows (first row = headers). Rows are matched to existing
 * products by item code (SKU): a match is updated with the columns present in the file, anything
 * else is created. Column names are matched loosely, so the download template, the app's own
 * export, and most hand-made sheets all work.
 */

export const MAX_IMPORT_ROWS = 5000;

type TextField = "sku" | "name" | "description" | "category" | "subcategory" | "hsnSac" | "manufacturer" | "barcode" | "material" | "finish" | "countryOfOrigin" | "currency";
type DecimalField = "weightKg" | "grossWeightKg" | "lengthCm" | "widthCm" | "heightCm" | "saleRate";
type IntField = "unitsPerCarton" | "moq";
type Field = TextField | DecimalField | IntField | "unit" | "taxRate" | "isActive";

const ALIASES: Record<Field, string[]> = {
  sku: ["sku", "itemcode", "code", "itemno", "productcode"],
  name: ["name", "itemname", "productname", "product", "item"],
  description: ["description", "desc", "details"],
  category: ["category"],
  subcategory: ["subcategory"],
  hsnSac: ["hsnsac", "hsn", "hsncode", "hsnsaccode", "sac"],
  manufacturer: ["manufacturer", "maker", "brand"],
  barcode: ["barcode", "ean", "upc", "gtin"],
  material: ["material"],
  finish: ["finish", "colourfinish", "colorfinish", "colour", "color"],
  countryOfOrigin: ["countryoforigin", "origin"],
  currency: ["currency"],
  weightKg: ["weightkg", "netweightkg", "weight", "netweight", "netweightperpiecekg", "netkg"],
  grossWeightKg: ["grossweightkg", "grossweight", "grossweightperpiecekg", "grosskg"],
  lengthCm: ["lengthcm", "length"],
  widthCm: ["widthcm", "width"],
  heightCm: ["heightcm", "height"],
  saleRate: ["salerate", "rate", "price", "saleprice", "sellingprice", "unitprice"],
  unitsPerCarton: ["unitspercarton", "piecespercarton", "pcspercarton", "pcsctn", "qtypercarton"],
  moq: ["moq", "minimumorderqty", "minimumorderquantity"],
  unit: ["unitcode", "unit", "uom"],
  taxRate: ["taxratename", "taxrate", "gst", "gstrate", "tax"],
  isActive: ["isactive", "active", "status"]
};

const TEXT_LIMITS: Record<TextField, number> = {
  sku: 80, name: 180, description: 5000, category: 120, subcategory: 120, hsnSac: 20, manufacturer: 160,
  barcode: 120, material: 120, finish: 120, countryOfOrigin: 80, currency: 3
};
const DECIMAL_FIELDS: DecimalField[] = ["weightKg", "grossWeightKg", "lengthCm", "widthCm", "heightCm", "saleRate"];
const INT_FIELDS: IntField[] = ["unitsPerCarton", "moq"];

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  unknownColumns: string[];
};

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Maps each recognised column index to a product field. */
export function mapColumns(headers: string[]) {
  const columns = new Map<number, Field>();
  const unknown: string[] = [];
  headers.forEach((header, index) => {
    const key = normalise(header);
    if (!key) return;
    const field = (Object.keys(ALIASES) as Field[]).find((candidate) => ALIASES[candidate].includes(key));
    if (field && ![...columns.values()].includes(field)) columns.set(index, field);
    else if (!field && key !== "imagestatus") unknown.push(header);
  });
  return { columns, unknown };
}

function parseNumber(raw: string): number | null {
  const clean = raw.replace(/[,\s₹$€£]/g, "").replace(/^(rs\.?|inr|usd)/i, "");
  if (clean === "") return null;
  const value = Number(clean);
  if (!Number.isFinite(value) || value < 0) throw new Error(`"${raw}" is not a valid number`);
  return value;
}

function parseActive(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (["true", "yes", "y", "1", "active"].includes(value)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(value)) return false;
  throw new Error(`"${raw}" should be Active/Inactive or true/false`);
}

export async function importItemRows(context: TenantContext, rows: string[][]): Promise<ImportResult> {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:manage");
  const organisationId = tenant.organisationId;

  if (rows.length < 2) throw new Error("The file has no product rows. Keep the header row and add one product per row.");
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`The file has ${rows.length - 1} rows; import at most ${MAX_IMPORT_ROWS} at a time.`);

  const { columns, unknown } = mapColumns(rows[0]);
  const fields = [...columns.values()];
  if (!fields.includes("name") && !fields.includes("sku")) {
    throw new Error("No Name or Item code (SKU) column found. Use the template headers in the first row.");
  }

  const [existingItems, units, taxRates] = await Promise.all([
    prisma.item.findMany({ where: { organisationId, sku: { not: null } }, select: { id: true, sku: true } }),
    prisma.unit.findMany({ where: { organisationId } }),
    prisma.taxRate.findMany({ where: { organisationId } })
  ]);
  const itemBySku = new Map(existingItems.map((item) => [item.sku!.toLowerCase(), item.id]));
  const unitByCode = new Map(units.map((unit) => [unit.code.toUpperCase(), unit.id]));

  const findTaxRate = (raw: string): string | null => {
    const value = raw.trim().toLowerCase();
    const byName = taxRates.find((rate) => rate.name.toLowerCase() === value || `${rate.name} ${rate.rate.toString()}%`.toLowerCase() === value);
    if (byName) return byName.id;
    const percent = /(\d+(?:\.\d+)?)\s*%?\s*$/.exec(value)?.[1];
    if (percent !== undefined) {
      const byRate = taxRates.find((rate) => Number(rate.rate) === Number(percent));
      if (byRate) return byRate.id;
    }
    return null;
  };

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], unknownColumns: unknown };

  for (let r = 1; r < rows.length; r += 1) {
    const rowNumber = r + 1;
    const cells = rows[r];
    try {
      const data: Prisma.ItemUncheckedUpdateInput = {};
      let sku = "";
      let name = "";
      for (const [index, field] of columns) {
        const raw = (cells[index] ?? "").trim();
        if (field === "sku") sku = raw;
        if (field === "name") name = raw;
        if (raw === "" && field !== "sku") continue; // blank cells leave existing values alone

        if (field in TEXT_LIMITS) {
          const limit = TEXT_LIMITS[field as TextField];
          if (raw.length > limit) throw new Error(`${field} is longer than ${limit} characters`);
          if (field === "currency" && !/^[a-z]{3}$/i.test(raw)) throw new Error(`currency "${raw}" should be a 3-letter code like INR`);
          (data as Record<string, unknown>)[field] = field === "currency" ? raw.toUpperCase() : raw || null;
        } else if (DECIMAL_FIELDS.includes(field as DecimalField)) {
          const value = parseNumber(raw);
          if (value !== null) (data as Record<string, unknown>)[field] = new Prisma.Decimal(value);
        } else if (INT_FIELDS.includes(field as IntField)) {
          const value = parseNumber(raw);
          if (value !== null) {
            if (!Number.isInteger(value)) throw new Error(`${field} must be a whole number`);
            (data as Record<string, unknown>)[field] = value;
          }
        } else if (field === "unit") {
          const code = raw.toUpperCase().slice(0, 20);
          let unitId = unitByCode.get(code);
          if (!unitId) {
            const unit = await prisma.unit.create({ data: { organisationId, code, name: code } });
            unitId = unit.id;
            unitByCode.set(code, unitId);
          }
          data.unitId = unitId;
        } else if (field === "taxRate") {
          const taxRateId = findTaxRate(raw);
          if (!taxRateId) throw new Error(`tax rate "${raw}" does not match any tax rate in Products → tax rates`);
          data.taxRateId = taxRateId;
        } else if (field === "isActive") {
          const value = parseActive(raw);
          if (value !== null) data.isActive = value;
        }
      }

      if (!sku && !name) {
        result.skipped += 1;
        continue;
      }
      if (!sku) delete data.sku;

      const existingId = sku ? itemBySku.get(sku.toLowerCase()) : undefined;
      if (existingId) {
        delete data.sku;
        await prisma.item.update({ where: { id: existingId }, data });
        result.updated += 1;
      } else {
        if (!name) throw new Error("a new product needs a Name");
        const created = await prisma.item.create({
          data: {
            ...(data as Prisma.ItemUncheckedCreateInput),
            name,
            sku: sku || null,
            organisationId,
            imageStatus: "pending"
          }
        });
        if (sku) itemBySku.set(sku.toLowerCase(), created.id);
        result.created += 1;
      }
    } catch (error) {
      result.skipped += 1;
      if (result.errors.length < 20) {
        const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? "item code (SKU) is already used by another product"
          : error instanceof Error ? error.message : "could not be imported";
        result.errors.push(`Row ${rowNumber}: ${message}`);
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      organisationId,
      actorUserId: tenant.userId,
      action: "item.import",
      entityType: "item",
      metadata: { created: result.created, updated: result.updated, skipped: result.skipped, rows: rows.length - 1 }
    }
  });

  return result;
}
