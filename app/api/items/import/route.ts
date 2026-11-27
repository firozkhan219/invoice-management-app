import { FormError, handleTenantForm, withFlash } from "@/lib/http/form";
import { importItemRows } from "@/lib/items/item-import";
import { readSpreadsheet } from "@/lib/items/spreadsheet";

const MAX_BYTES = 10 * 1024 * 1024;

/** Imports products from an uploaded .xlsx or .csv file and reports what happened. */
export async function POST(request: Request) {
  return handleTenantForm(request, {
    errorPath: "/items",
    handler: async ({ context, formData }) => {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) throw new FormError("Choose an Excel (.xlsx) or CSV file to import.");
      if (file.size > MAX_BYTES) throw new FormError("The file is larger than 10 MB. Split it into smaller files.");

      let rows: string[][];
      try {
        rows = readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
      } catch (error) {
        throw new FormError(error instanceof Error ? error.message : "The file could not be read.");
      }

      const result = await importItemRows(context, rows);
      const parts = [`${result.created} added`, `${result.updated} updated`];
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      let message = `Import finished: ${parts.join(", ")}.`;
      if (result.errors.length) message += ` ${result.errors.slice(0, 5).join(" · ")}${result.errors.length > 5 ? " …" : ""}`;
      if (result.unknownColumns.length) message += ` Ignored columns: ${result.unknownColumns.slice(0, 6).join(", ")}.`;
      return withFlash("/items", result.created + result.updated > 0 ? "notice" : "error", message);
    }
  });
}
