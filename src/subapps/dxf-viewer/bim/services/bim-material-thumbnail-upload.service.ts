'use client';

/**
 * ADR-413 §2D Phase 2 — BIM Material appearance-thumbnail upload service.
 *
 * Validates a user-supplied image (Revit «Appearance asset → image») and uploads
 * it to Firebase Storage under a company-scoped, `materialId`-keyed path — the ONE
 * central appearance asset per material. The returned download URL is then
 * persisted on the `bim_materials/{materialId}` doc as `thumbnailUrl`, which wins
 * over the Phase-1 PBR albedo swatch everywhere a `BimMaterial` doc is rendered.
 *
 * ADR-651 Φάση Ε (N.0.2 Boy-Scout): ο πυρήνας «validate → uploadBytes → getDownloadURL»
 * **βγήκε** στο `@/services/upload/image-asset-upload` (SSoT) όταν απέκτησε τέταρτο
 * καταναλωτή (σφραγίδα μηχανικού). Εδώ μένει ΜΟΝΟ ό,τι είναι material-specific: το path,
 * το όριο μεγέθους και ο τύπος σφάλματος που ήδη καταναλώνει το UI.
 *
 * @see @/services/upload/image-asset-upload — ο κοινός uploader (SSoT)
 * @see ./MaterialLibraryService.ts — persists the returned URL on the doc
 * @see @/services/upload/utils/storage-path — buildBimMaterialThumbnailPath SSoT
 */

import {
  deleteImageAssetByUrl,
  ImageAssetUploadError,
  uploadImageAsset,
  validateImageAssetFile,
} from '@/services/upload/image-asset-upload';
import {
  buildBimMaterialThumbnailPath,
  type BimMaterialThumbnailExt,
} from '@/services/upload/utils/storage-path';

/** Soft client cap (≤2MB). The storage rule enforces a ≤5MB hard cap. */
export const MATERIAL_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

export interface MaterialThumbnailUploadInput {
  readonly file: File;
  readonly companyId: string;
  readonly materialId: string;
}

export interface MaterialThumbnailUploadResult {
  readonly storagePath: string;
  readonly downloadUrl: string;
  readonly ext: BimMaterialThumbnailExt;
}

export type MaterialThumbnailUploadErrorCode =
  | 'format'
  | 'size'
  | 'missing-company'
  | 'missing-material'
  | 'upload-failed';

export class MaterialThumbnailUploadError extends Error {
  readonly code: MaterialThumbnailUploadErrorCode;
  constructor(code: MaterialThumbnailUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MaterialThumbnailUploadError';
  }
}

/** Τα codes του κοινού uploader ταυτίζονται· ξαναπετιούνται ως material-specific σφάλμα. */
function asMaterialError(err: unknown): MaterialThumbnailUploadError {
  if (err instanceof ImageAssetUploadError) {
    return new MaterialThumbnailUploadError(err.code, err.message);
  }
  return new MaterialThumbnailUploadError(
    'upload-failed',
    err instanceof Error ? err.message : String(err),
  );
}

/** Validates extension + size. Throws a typed error; returns the resolved ext. */
export function validateMaterialThumbnailFile(file: File): BimMaterialThumbnailExt {
  try {
    return validateImageAssetFile(file, MATERIAL_THUMBNAIL_MAX_BYTES);
  } catch (err) {
    throw asMaterialError(err);
  }
}

export async function uploadMaterialThumbnail(
  input: MaterialThumbnailUploadInput,
): Promise<MaterialThumbnailUploadResult> {
  const { file, companyId, materialId } = input;
  if (!companyId) throw new MaterialThumbnailUploadError('missing-company');
  if (!materialId) throw new MaterialThumbnailUploadError('missing-material');

  const ext = validateMaterialThumbnailFile(file);
  const storagePath = buildBimMaterialThumbnailPath({ companyId, materialId, ext });

  try {
    const downloadUrl = await uploadImageAsset({ file, storagePath, ext });
    return { storagePath, downloadUrl, ext };
  } catch (err) {
    throw asMaterialError(err);
  }
}

/**
 * Deletes the Storage object behind a material thumbnail **download URL**. No-op on a
 * falsy URL. Missing-object errors are swallowed by the caller (best-effort cleanup —
 * the Firestore doc is the source of truth for existence; an orphan blob must never
 * block the delete UX).
 *
 * @see ./hatch-image-delete.service.ts — the orchestrator (doc delete → this)
 */
export async function deleteMaterialThumbnailByUrl(url: string): Promise<void> {
  await deleteImageAssetByUrl(url);
}
