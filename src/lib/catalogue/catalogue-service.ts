import { prisma } from "@/lib/db/prisma";
import type { CataloguePdfInput } from "@/lib/validation/catalogue";
import { assertPermission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";

/** Products (with photo flag) and categories for the catalogue builder screen. */
export async function getCatalogueWorkspace(context: TenantContext) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");

  const items = await prisma.item.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    include: { unit: true },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });
  const companies = await prisma.company.findMany({
    where: { organisationId: tenant.organisationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { legalName: "asc" }],
    select: { id: true, legalName: true, tradingName: true }
  });
  const categories = [...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))];

  return {
    companies,
    categories,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      price: item.saleRate ? `${item.currency} ${formatPrice(item.saleRate.toString())}` : null,
      hasPhoto: Boolean(item.imageAssetId)
    }))
  };
}

export async function generateCataloguePdf(context: TenantContext, input: CataloguePdfInput) {
  const tenant = requireTenantContext(context);
  assertPermission(tenant.role, "masters:read");
  assertPermission(tenant.role, "documents:download");

  const items = await prisma.item.findMany({
    where: { organisationId: tenant.organisationId, id: { in: input.itemIds } },
    include: { unit: true }
  });
  if (items.length === 0) throw new Error("Select at least one product for the catalogue.");
  // Keep the order the user ticked them in.
  const order = new Map(input.itemIds.map((id, index) => [id, index]));
  items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const company = input.companyId
    ? await prisma.company.findFirst({ where: { id: input.companyId, organisationId: tenant.organisationId } })
    : await prisma.company.findFirst({
        where: { organisationId: tenant.organisationId, isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
      });

  const [{ renderCataloguePdf }, { readPrivateDocument }, { loadCompanyPdfAssets }] = await Promise.all([
    import("@/lib/catalogue/catalogue-pdf"),
    import("@/lib/documents/document-storage"),
    import("@/lib/invoices/invoice-service")
  ]);

  const assetIds = items.map((item) => item.imageAssetId).filter((value): value is string => Boolean(value));
  const assets = assetIds.length
    ? await prisma.fileAsset.findMany({ where: { organisationId: tenant.organisationId, id: { in: assetIds }, kind: "item_image" } })
    : [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const products = await Promise.all(items.map(async (item) => {
    const asset = item.imageAssetId ? assetById.get(item.imageAssetId) : undefined;
    let image = null;
    if (asset) {
      try {
        image = { data: await readPrivateDocument(asset.storageKey), mimeType: asset.mimeType };
      } catch {
        image = null;
      }
    }
    return {
      name: item.name,
      sku: item.sku,
      price: item.saleRate ? `${item.currency} ${formatPrice(item.saleRate.toString())}` : null,
      category: item.category,
      subcategory: item.subcategory,
      description: item.description,
      hsnSac: item.hsnSac,
      unit: item.unit?.name || item.unit?.code || null,
      weightKg: item.weightKg ? Number(item.weightKg.toString()).toString() : null,
      manufacturer: item.manufacturer,
      barcode: item.barcode,
      image
    };
  }));

  const { logo } = input.showLogo ? await loadCompanyPdfAssets(tenant.organisationId, company?.id ?? null) : { logo: null };
  const contact = company ? [company.phone, company.email, [company.city, company.state].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ") : null;
  const title = input.title || "Product Catalogue";

  const buffer = await renderCataloguePdf({
    title,
    companyName: company?.tradingName || company?.legalName || "Product Catalogue",
    companyContact: contact || null,
    logo,
    layout: input.layout,
    fields: input.fields,
    products
  });

  await prisma.auditLog.create({
    data: {
      organisationId: tenant.organisationId,
      actorUserId: tenant.userId,
      action: "catalogue_pdf.generate",
      entityType: "catalogue",
      entityId: tenant.organisationId,
      metadata: { itemCount: items.length, layout: input.layout, fields: input.fields }
    }
  });

  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "catalogue";
  return { buffer, filename: `${safeTitle}-${input.layout}-per-page.pdf` };
}

function formatPrice(value: string): string {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
