/**
 * media-tab-configs — per-tab presentational config for EntityMediaFilesTab
 *
 * The "per-tab" half of the shell+config pattern: each constant describes ONE
 * media tab (Photos / Videos / Documents / Floorplan) in an entity-agnostic
 * way. Combined with an {@link EntityMediaBinding} the generic shell renders
 * the correct EntityFilesManager for either Parking or Storage.
 *
 * Config/data file — no logic (exempt from the 40-line / 500-line limits).
 *
 * @module components/space-management/shared/tabs/media-tab-configs
 * @see ADR-588 — Space Media Tab Shell
 * @see ADR-031 — Canonical File Storage System
 */

import type { FileCategory, FileDomain } from '@/config/domain-constants';
import { DEFAULT_PHOTO_ACCEPT, DEFAULT_VIDEO_ACCEPT } from '@/config/file-upload-config';

/** Presentational + storage configuration for a single media/files tab. */
export interface MediaTabConfig {
  domain: FileDomain;
  category: FileCategory;
  /** Suffix composed with the binding prefix → `${prefix}-${purposeKey}`. */
  purposeKey: string;
  displayStyle?: 'standard' | 'media-gallery' | 'floorplan-gallery';
  acceptedTypes?: string;
  entryPointCategoryFilter?: FileCategory;
  entryPointExcludeCategories?: FileCategory[];
  /** i18n key (within the entity namespace) for the unauthenticated message. */
  signInKey: string;
  /** Floorplan tab needs the company display name resolved for headers. */
  needsCompanyName?: boolean;
}

/**
 * Accepted file types for floorplans (DXF, PDF, images). Superset covering
 * both the parking (extra DXF MIME aliases) and storage variants.
 */
const FLOORPLAN_ACCEPT =
  '.dxf,.pdf,application/pdf,application/dxf,image/vnd.dxf,.jpg,.jpeg,.png,image/jpeg,image/png';

export const PHOTOS_MEDIA_CONFIG: MediaTabConfig = {
  domain: 'construction',
  category: 'photos',
  purposeKey: 'photo',
  displayStyle: 'media-gallery',
  acceptedTypes: DEFAULT_PHOTO_ACCEPT,
  entryPointCategoryFilter: 'photos',
  signInKey: 'auth.signInToViewPhotos',
};

export const VIDEOS_MEDIA_CONFIG: MediaTabConfig = {
  domain: 'construction',
  category: 'videos',
  purposeKey: 'video',
  displayStyle: 'media-gallery',
  acceptedTypes: DEFAULT_VIDEO_ACCEPT,
  entryPointCategoryFilter: 'videos',
  signInKey: 'auth.signInToViewVideos',
};

export const DOCUMENTS_MEDIA_CONFIG: MediaTabConfig = {
  domain: 'construction',
  category: 'documents',
  purposeKey: 'document',
  entryPointExcludeCategories: ['photos', 'videos', 'floorplans'],
  signInKey: 'auth.signInToViewDocuments',
};

export const FLOORPLAN_MEDIA_CONFIG: MediaTabConfig = {
  domain: 'construction',
  category: 'floorplans',
  purposeKey: 'floorplan',
  displayStyle: 'floorplan-gallery',
  acceptedTypes: FLOORPLAN_ACCEPT,
  entryPointCategoryFilter: 'floorplans',
  signInKey: 'auth.signInToViewFloorplans',
  needsCompanyName: true,
};
