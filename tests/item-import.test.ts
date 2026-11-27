import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { mapColumns } from "@/lib/items/item-import";
import { parseCsv, readSpreadsheet } from "@/lib/items/spreadsheet";

/** Builds a tiny .xlsx (zip of XML parts) the way Excel stores it, for the reader test. */
function buildXlsx(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(Buffer.byteLength(text), 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe("spreadsheet reader", () => {
  it("parses quoted CSV with commas, quotes and new lines", () => {
    const rows = parseCsv('\uFEFFsku,name,description\n"AYK-001","Copper lota","Laser print, ""gift"" box\nsecond line"\n\nAYK-002,Brass tray,\n');
    expect(rows).toEqual([
      ["sku", "name", "description"],
      ["AYK-001", "Copper lota", 'Laser print, "gift" box\nsecond line'],
      ["AYK-002", "Brass tray", ""]
    ]);
  });

  it("detects semicolon-separated CSV", () => {
    expect(parseCsv("sku;name\nA1;Lamp\n")).toEqual([["sku", "name"], ["A1", "Lamp"]]);
  });

  it("reads the first sheet of an .xlsx with shared and inline strings, numbers and gaps", () => {
    const xlsx = buildXlsx({
      "xl/workbook.xml": '<workbook><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": '<sst><si><t>SKU</t></si><si><t>Name</t></si><si><t>Sale rate</t></si><si><r><t>Brass </t></r><r><t>tray &amp; dibbi</t></r></si></sst>',
      "xl/worksheets/sheet1.xml": '<worksheet><sheetData>'
        + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
        + '<row r="2"><c r="A2" t="inlineStr"><is><t>AYK-002</t></is></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>1350</v></c></row>'
        + '<row r="3"><c r="A3" t="inlineStr"><is><t>AYK-003</t></is></c><c r="C3"><v>99.5</v></c></row>'
        + '</sheetData></worksheet>'
    });
    expect(readSpreadsheet(xlsx, "products.xlsx")).toEqual([
      ["SKU", "Name", "Sale rate"],
      ["AYK-002", "Brass tray & dibbi", "1350"],
      ["AYK-003", "", "99.5"]
    ]);
  });

  it("refuses old .xls files with a clear message", () => {
    expect(() => readSpreadsheet(Buffer.from("x"), "old.xls")).toThrow(/\.xlsx/);
  });
});

describe("import column matching", () => {
  it("understands the template headers", () => {
    const { columns, unknown } = mapColumns(["sku", "name", "hsnSac", "weightKg", "unitCode", "taxRateName", "saleRate", "isActive"]);
    expect([...columns.values()]).toEqual(["sku", "name", "hsnSac", "weightKg", "unit", "taxRate", "saleRate", "isActive"]);
    expect(unknown).toEqual([]);
  });

  it("understands the app's own export headers and ignores Image status", () => {
    const { columns, unknown } = mapColumns(["SKU", "Name", "HSN/SAC", "Weight KG", "Unit", "Tax rate", "Sale rate", "Active", "Units per carton", "Image status", "Notes"]);
    expect([...columns.values()]).toEqual(["sku", "name", "hsnSac", "weightKg", "unit", "taxRate", "saleRate", "isActive", "unitsPerCarton"]);
    expect(unknown).toEqual(["Notes"]);
  });
});
