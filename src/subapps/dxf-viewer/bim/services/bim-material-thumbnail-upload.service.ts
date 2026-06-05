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
 * Mirrors the upload pattern of `bim-3d/lighting/hdri-upload.service.ts`
 * (validate → buildPath → uploadBytes → getDownloadURL, typed error codes).
 *
 * @see ./MaterialLibraryService.ts — persists the returned URL on the doc
 * @see @/services/upload/utils/storage-path — buildBimMaterialThumbnailPath SSoT
 * @see ../../../bim-3d/lighting/hdri-upload.service.ts — the mirrored template
 */

import { ref as makeStorageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
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
export function validateMaterialThumbnailFile(file: File): BimMaterialThumbnailExt {
  const ext = detectExtension(file);
  if (!ext) throw new MaterialThumbnailUploadError('format');
  if (file.size > MATERIAL_THUMBNAIL_MAX_BYTES) throw new MaterialThumbnailUploadError('size');
  return ext;
}

export async function uploadMaterialThumbnail(
  input: MaterialThumbnailUploadInput,
): Promise<MaterialThumbnailUploadResult> {
  const { file, companyId, materialId } = input;
  if (!companyId) throw new MaterialThumbnailUploadError('missing-company');
  if (!materialId) throw new MaterialThumbnailUploadError('missing-material');

  const ext = validateMaterialThumbnailFile(file);
  const storagePath = buildBimMaterialThumbnailPath({ companyId, materialId, ext });
  const fileRef = makeStorageRef(storage, storagePath);

  try {
    await uploadBytes(fileRef, file, { contentType: contentTypeFor(ext) });
    const downloadUrl = await getDownloadURL(fileRef);
    return { storagePath, downloadUrl, ext };
  } catch (err) {
    throw new MaterialThumbnailUploadError(
      'upload-failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}
