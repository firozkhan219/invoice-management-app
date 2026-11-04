import { prisma } from "@/lib/db/prisma";
import { readStoredFile } from "@/lib/files/file-assets";

export type CompanyImages = {
  logo: Buffer | null;
  signature: Buffer | null;
};

/**
 * Loads logo/signature bytes for a document. Pass the company record used on the document
 * (issued snapshot or live row); asset ids are read from it so issued invoices keep the
 * images they were issued with. Missing or unreadable images are skipped.
 */
export async function loadCompanyImages(
  organisationId: string,
  company: Record<string, unknown> | null | undefined
): Promise<CompanyImages> {
  const logoAssetId = typeof company?.logoAssetId === "string" ? company.logoAssetId : null;
  const signatureAssetId = typeof company?.signatureAssetId === "string" ? company.signatureAssetId : null;
  const ids = [logoAssetId, signatureAssetId].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return { logo: null, signature: null };

  const assets = await prisma.fileAsset.findMany({
    where: { organisationId, id: { in: ids } },
    select: { id: true, storageKey: true }
  });
  const load = async (id: string | null) => {
    const asset = id ? assets.find((candidate) => candidate.id === id) : undefined;
    return asset ? readStoredFile(asset.storageKey) : null;
  };

  const [logo, signature] = await Promise.all([load(logoAssetId), load(signatureAssetId)]);
  return { logo, signature };
}
