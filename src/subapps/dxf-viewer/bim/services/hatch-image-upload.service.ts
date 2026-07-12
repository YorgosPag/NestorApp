'use client';

/**
 * ADR-643 Φ4 — user hatch image upload (thin orchestrator, FULL SSoT reuse).
 *
 * Big-player model (Revit/Cinema 4D/Figma): a user-uploaded fill image is a
 * first-class entry in the shared material library (`bim_materials`), referenced
 * by id — NOT a separate asset type. Reuses the ADR-413 upload chain end-to-end:
 * enterprise id (`generateBimMaterialId`, via `saveMaterial`) +
 * `uploadMaterialThumbnail` (company-scoped Storage, N.6) + `MaterialLibraryService`.
 * Zero new service / collection / prefix / storage rule.
 *
 * Flow: validate → create a minimal library doc (get id) → upload the thumbnail
 * (Storage path keyed by that id) → patch the doc with the download URL → register
 * in the 2D image store (immediate in-session render). On any post-create failure
 * the orphan doc is torn down (belt-and-suspenders, N.7.2).
 *
 * @see ./bim-material-thumbnail-upload.service.ts — the reused Storage upload SSoT
 * @see ./MaterialLibraryService.ts — the reused setDoc + enterprise-id writer
 * @see ../../rendering/entities/shared/user-material-image-store.ts — immediate register
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4 Φ4
 */

import { createMaterialLibraryService } from './MaterialLibraryService';
import {
  uploadMaterialThumbnail,
  validateMaterialThumbnailFile,
} from './bim-material-thumbnail-upload.service';
import { registerUserMaterialImage } from '../../rendering/entities/shared/user-material-image-store';

export interface HatchImageUploadInput {
  readonly file: File;
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
  /** i18n-resolved default library name when the file name has no usable base. */
  readonly fallbackName: string;
}

export interface HatchImageUploadResult {
  /** `bmat_*` id = the `HatchImageFill.assetId`. */
  readonly assetId: string;
  /** Firebase Storage download URL of the uploaded image. */
  readonly url: string;
}

/** Human-friendly library name from the file name (data, not a UI string). */
function deriveMaterialName(fileName: string, fallback: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '').trim();
  return base.length > 0 ? base : fallback;
}

/**
 * Uploads a user image and registers it as a company-scope library material whose
 * id becomes the hatch `imageFill.assetId`. Throws a `MaterialThumbnailUploadError`
 * on invalid file / upload failure (the orphan doc is cleaned up first).
 */
export async function uploadHatchImageMaterial(
  input: HatchImageUploadInput,
): Promise<HatchImageUploadResult> {
  const { file, companyId, userId, projectId, fallbackName } = input;
  validateMaterialThumbnailFile(file); // fail fast — before creating any doc

  const service = createMaterialLibraryService({ companyId, userId, projectId });
  const name = deriveMaterialName(file.name, fallbackName);
  const material = await service.saveMaterial({
    scope: 'company',
    nameEl: name,
    nameEn: name,
    category: 'other',
    atoeCategory: '', // image-fill asset — no BOQ/ΑΤΟΕ mapping
    defaultUnit: 'm2',
  });

  try {
    const { downloadUrl } = await uploadMaterialThumbnail({ file, companyId, materialId: material.id });
    await service.updateMaterial(material.id, { thumbnailUrl: downloadUrl });
    registerUserMaterialImage(material.id, downloadUrl);
    return { assetId: material.id, url: downloadUrl };
  } catch (err) {
    // Orphan cleanup — the doc exists but carries no usable image.
    await service.deleteMaterial(material.id).catch(() => {});
    throw err;
  }
}
