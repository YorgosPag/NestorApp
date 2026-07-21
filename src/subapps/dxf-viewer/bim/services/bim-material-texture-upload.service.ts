'use client';

/**
 * ADR-413 §2D Phase 3 — BIM Material PBR texture-map upload service.
 *
 * Validates a user-supplied image for ONE PBR map channel (albedo/normal/
 * roughness/ao — Revit «Appearance asset → Image» per-map slot) and uploads it to
 * Firebase Storage under a company-scoped, `materialId`-keyed path. The returned
 * download URLs are persisted on the `bim_materials/{materialId}` doc under
 * `pbrTextures.<map>Url`, which the 3D material catalog reads to render the
 * material's real textures on walls in the 3D viewport (NOT just a 2D thumbnail).
 *
 * Mirrors `bim-material-thumbnail-upload.service.ts` (Phase 2): validate →
 * buildPath → uploadBytes → getDownloadURL, typed error codes. The difference is
 * the per-map sub-key (`<map>.jpg`) and a higher size cap (texture maps —
 * especially 2K/4K albedo — are larger than a swatch thumbnail).
 *
 * @see ./MaterialLibraryService.ts — persists the returned URLs on the doc
 * @see @/services/upload/utils/storage-path — buildBimMaterialTextureMapPath SSoT
 * @see ../../bim-3d/materials/user-material-registry.ts — loads the URLs into 3D
 * @see ./bim-material-thumbnail-upload.service.ts — the mirrored Phase-2 template
 */

import { ref as makeStorageRef, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  buildBimMaterialTextureMapPath,
  type BimMaterialThumbnailExt,
  type BimMaterialTextureMapName,
} from '@/services/upload/utils/storage-path';

/** Soft client cap (≤8MB per map). The storage rule enforces a ≤10MB hard cap. */
export const MATERIAL_TEXTURE_MAX_BYTES = 8 * 1024 * 1024;

export interface MaterialTextureUploadInput {
  readonly file: File;
  readonly companyId: string;
  readonly materialId: string;
  readonly map: BimMaterialTextureMapName;
}

export interface MaterialTextureUploadResult {
  readonly storagePath: string;
  readonly downloadUrl: string;
  readonly ext: BimMaterialThumbnailExt;
}

export type MaterialTextureUploadErrorCode =
  | 'format'
  | 'size'
  | 'missing-company'
  | 'missing-material'
  | 'upload-failed';

export class MaterialTextureUploadError extends Error {
  readonly code: MaterialTextureUploadErrorCode;
  constructor(code: MaterialTextureUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MaterialTextureUploadError';
  }
}

function detectExtension(file: File): BimMaterialThumbnailExt | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg')) return 'jpg';
  if (lower.endsWith('.jpeg')) return 'jpeg';
  if (lower.endsWith('.webp')) return 'webp';
  return null;
}

function contentTypeFor(ext: BimMaterialThumbnailExt): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
  }
}

/** Validates extension + size. Throws a typed error; returns the resolved ext. */
export function validateMaterialTextureFile(file: File): BimMaterialThumbnailExt {
  const ext = detectExtension(file);
  if (!ext) throw new MaterialTextureUploadError('format');
  if (file.size > MATERIAL_TEXTURE_MAX_BYTES) throw new MaterialTextureUploadError('size');
  return ext;
}

/**
 * Uploads ONE PBR map of a material. Returns the storage path + download URL,
 * which the caller persists on the doc as `pbrTextures.<map>Url`.
 */
export async function uploadMaterialTextureMap(
  input: MaterialTextureUploadInput,
): Promise<MaterialTextureUploadResult> {
  const { file, companyId, materialId, map } = input;
  if (!companyId) throw new MaterialTextureUploadError('missing-company');
  if (!materialId) throw new MaterialTextureUploadError('missing-material');

  const ext = validateMaterialTextureFile(file);
  const storagePath = buildBimMaterialTextureMapPath({ companyId, materialId, map, ext });
  const fileRef = makeStorageRef(storage, storagePath);

  try {
    await uploadBytes(fileRef, file, { contentType: contentTypeFor(ext) });
    const downloadUrl = await getDownloadURL(fileRef);
    // Verify-after-write (atomic verified asset commit — Revit/ArchiCAD asset durability).
    // getDownloadURL already proves the object existed a moment ago; this second, independent
    // getMetadata assert converts a silent «wrote-but-not-durable» outcome into a typed error so
    // the caller can rollback instead of persisting a ghost material doc that points at a 403 URL.
    await assertTextureDurable(storagePath);
    return { storagePath, downloadUrl, ext };
  } catch (err) {
    if (err instanceof MaterialTextureUploadError) throw err;
    throw new MaterialTextureUploadError(
      'upload-failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Throws `upload-failed` if the just-written object is not durably present (object-not-found). */
async function assertTextureDurable(storagePath: string): Promise<void> {
  const reachable = await isMaterialTextureReachable(storagePath);
  if (!reachable) {
    throw new MaterialTextureUploadError(
      'upload-failed',
      `texture not durable after upload: ${storagePath}`,
    );
  }
}

/**
 * Durability probe SSoT — is a material texture object actually present in Storage?
 *
 * Accepts either a storage path (`companies/.../albedo.jpg`) or a full `getDownloadURL` https URL
 * (`ref(storage, url)` parses both). Uses the authenticated Admin-rules read path (`getMetadata`),
 * NOT the download token, so a company member probing their own material resolves via the storage
 * rule. Returns `false` ONLY on a definitive `storage/object-not-found` (→ safe to re-upload/repair);
 * any other error (permission/network/parse ambiguity) returns `true` to avoid a false repair loop.
 *
 * Consumers:
 *  - {@link uploadMaterialTextureMap} — verify-after-write (durable-commit guarantee)
 *  - import self-healing — a «known» `bmat_*` whose albedo is unreachable is re-uploaded in place
 *    (see io/mesh3d-material-import/import-foreign-textures.ts)
 */
export async function isMaterialTextureReachable(urlOrPath: string): Promise<boolean> {
  try {
    await getMetadata(makeStorageRef(storage, urlOrPath));
    return true;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'storage/object-not-found') return false;
    return true;
  }
}
