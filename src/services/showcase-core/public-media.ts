/**
 * =============================================================================
 * SHOWCASE CORE — Public media items, once
 * =============================================================================
 *
 * `{ id, url, displayName?, contentType? }` was declared **four times** — as
 * `BuildingShowcaseMedia`, `ProjectShowcaseMedia`, `ParkingShowcaseMedia` and
 * `StorageShowcaseMedia` — with byte-identical bodies, and the function that
 * fills it (`listEntityMedia` → filter → map) was copy-pasted into each of the
 * four public payload routes. Three of those type files even say so in their
 * header: *"Mirrors the building showcase type pattern"*.
 *
 * This module owns both the shape and the load. The four names survive as
 * aliases so no consumer had to change.
 *
 * @module services/showcase-core/public-media
 * @enterprise ADR-698 — Public Showcase Token Surface SSoT
 * @see ADR-321 Showcase Core
 */

import { listEntityMedia } from '@/services/property-media/property-media.service';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import type { FileCategory } from '@/config/domain-constants';

/**
 * One renderable media item in a public showcase payload.
 *
 * **Wire contract** — this is serialised straight into the anonymous public
 * response. `displayName` / `contentType` stay optional-and-nullable because
 * that is what the four originals declared and what the viewer clients read.
 */
export interface ShowcaseMediaItem {
  id: string;
  url: string;
  displayName?: string | null;
  contentType?: string | null;
}

/**
 * Rows the showcase surfaces ask for. All four routes used 30 and none made it
 * configurable; kept as a named constant rather than a magic literal.
 */
export const SHOWCASE_MEDIA_LIMIT = 30;

export interface LoadShowcaseMediaParams {
  companyId: string;
  /** `ENTITY_TYPES.*` value of the owning entity. */
  entityType: string;
  entityId: string;
  category: FileCategory;
  limit?: number;
}

/**
 * List an entity's media for public display.
 *
 * Items without a `downloadUrl` are dropped — an item the anonymous viewer
 * cannot fetch is not a media item, and every original did exactly this.
 */
export async function loadShowcaseMedia({
  companyId,
  entityType,
  entityId,
  category,
  limit = SHOWCASE_MEDIA_LIMIT,
}: LoadShowcaseMediaParams): Promise<ShowcaseMediaItem[]> {
  const metas = await listEntityMedia({ companyId, entityType, entityId, category, limit });

  return metas
    .filter(meta => meta.downloadUrl)
    .map<ShowcaseMediaItem>(meta => ({
      id: meta.id,
      url: meta.downloadUrl!,
      displayName: meta.displayName || meta.originalFilename || undefined,
      contentType: meta.contentType || undefined,
    }));
}

/** The two media buckets every public showcase payload carries. */
export interface ShowcaseMediaBuckets {
  photos: ShowcaseMediaItem[];
  floorplans: ShowcaseMediaItem[];
}

/**
 * Load photos and floorplans concurrently, tolerating either failing.
 *
 * A missing gallery must not turn a working showcase link into a 500 — every
 * original guarded each call with `.catch(() => [])` and that stays.
 */
export async function loadShowcaseMediaBuckets(params: {
  companyId: string;
  entityType: string;
  entityId: string;
}): Promise<ShowcaseMediaBuckets> {
  const [photos, floorplans] = await Promise.all([
    loadShowcaseMedia({ ...params, category: FILE_CATEGORIES.PHOTOS }).catch(() => []),
    loadShowcaseMedia({ ...params, category: FILE_CATEGORIES.FLOORPLANS }).catch(() => []),
  ]);

  return { photos, floorplans };
}
