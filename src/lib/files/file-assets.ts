import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import type { TenantContext } from "@/lib/repositories/tenant-context";

export type FileAssetKind = "company_logo" | "company_signature";

export type PreparedFileAsset = {
  organisationId: string;
  kind: FileAssetKind;
  originalName: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ASSET_ROOT = "company-assets";

// PDFKit can only embed PNG and JPEG, so those are the only accepted image types.
const imageSignatures: Array<{ mimeType: string; extension: string; magic: number[] }> = [
  { mimeType: "image/png", extension: ".png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: "image/jpeg", extension: ".jpg", magic: [0xff, 0xd8, 0xff] }
];

const kindLabel: Record<FileAssetKind, string> = {
  company_logo: "Logo",
  company_signature: "Signature"
};

function detectImage(bytes: Buffer) {
  return imageSignatures.find((signature) => signature.magic.every((byte, index) => bytes[index] === byte)) ?? null;
}

export function validateCompanyImageAsset(file: File, kind: FileAssetKind): void {
  if (!imageSignatures.some((signature) => signature.mimeType === file.type)) {
    throw new Error(`${kindLabel[kind]} must be a PNG or JPEG image.`);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${kindLabel[kind]} must be 2 MB or smaller.`);
  }
}

/** True when the form field holds an actual uploaded file (browsers send an empty File when nothing is chosen). */
export function isUploadedFile(value: FormDataEntryValue | null | undefined): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

export async function prepareFileAsset(
  context: TenantContext,
  file: File,
  kind: FileAssetKind
): Promise<PreparedFileAsset & { bytes: Buffer }> {
  validateCompanyImageAsset(file, kind);
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) throw new Error(`${kindLabel[kind]} is not a valid PNG or JPEG file.`);

  const storageKey = path.posix.join(ASSET_ROOT, context.organisationId, kind, `${crypto.randomUUID()}${detected.extension}`);

  return {
    organisationId: context.organisationId,
    kind,
    originalName: path.basename(file.name || `${kind}${detected.extension}`).slice(0, 255),
    storageKey,
    mimeType: detected.mimeType,
    byteSize: bytes.byteLength,
    checksumSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes
  };
}

function resolveStoragePath(storageKey: string): string {
  const uploadRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.UPLOAD_DIR);
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.UPLOAD_DIR, storageKey);
  if (!absolutePath.startsWith(uploadRoot + path.sep)) {
    throw new Error("Invalid file storage path.");
  }
  return absolutePath;
}

/** Validates, writes the image privately under UPLOAD_DIR and records a FileAsset row. */
export async function storeCompanyImage(context: TenantContext, file: File, kind: FileAssetKind) {
  const prepared = await prepareFileAsset(context, file, kind);
  const absolutePath = resolveStoragePath(prepared.storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, prepared.bytes);

  return prisma.fileAsset.create({
    data: {
      organisationId: prepared.organisationId,
      kind: prepared.kind,
      originalName: prepared.originalName,
      storageKey: prepared.storageKey,
      mimeType: prepared.mimeType,
      byteSize: prepared.byteSize,
      checksumSha256: prepared.checksumSha256
    }
  });
}

/** Reads a stored file's bytes; returns null if it is missing. */
export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveStoragePath(storageKey));
  } catch {
    return null;
  }
}

export function privateUploadRoot(): string {
  return env.UPLOAD_DIR;
}
