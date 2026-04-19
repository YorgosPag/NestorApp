/**
 * Property Showcase — Shared types (ADR-312 Phase 4)
 *
 * Mirror of the public API response returned from GET /api/showcase/[token].
 * Wire shape is re-exported from the server-side SSoT snapshot builder so the
 * web page and PDF generator can never drift.
 */

import type {
  PropertyShowcaseSnapshot,
  ShowcaseProjectInfo,
  ShowcaseCommercialInfo,
  ShowcaseAreas,
  ShowcaseLayout,
  ShowcaseConditionInfo,
  ShowcaseEnergyInfo,
  ShowcaseSystemsInfo,
  ShowcaseFinishesInfo,
  ShowcaseFeaturesInfo,
  ShowcaseLinkedSpace,
  ShowcaseViewInfo,
} from '@/services/property-showcase/snapshot-builder';

export type {
  ShowcaseProjectInfo,
  ShowcaseCommercialInfo,
  ShowcaseAreas,
  ShowcaseLayout,
  ShowcaseConditionInfo,
  ShowcaseEnergyInfo,
  ShowcaseSystemsInfo,
  ShowcaseFinishesInfo,
  ShowcaseFeaturesInfo,
  ShowcaseLinkedSpace,
  ShowcaseViewInfo,
};

export interface ShowcaseMedia {
  id: string;
  url: string;
  displayName?: string;
  /**
   * Raster preview URL for non-image originals (e.g. DXF Κατόψεις).
   * When present, the UI renders this inline; `url` still points to the
   * raw file download (DXF) for users who want the CAD original.
   */
  previewUrl?: string;
  /** Lowercased extension of the original file, used to drive rendering. */
  ext?: string;
}

export type ShowcasePropertySnapshot = PropertyShowcaseSnapshot['property'];

export interface ShowcaseCompanyBrand {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  /** Absolute logo URL (ADR-312 Phase 8). Undefined → UI falls back to the bundled Pagonis asset. */
  logoUrl?: string;
}

/**
 * Floorplan media grouped per linked parking/storage space.
 * Populated server-side by reading `files` for each linked space via
 * `listEntityMedia(entityType='parking'|'storage', entityId=<spaceId>)`.
 *
 * Phase 7.5 — each group also carries the κάτοψη ορόφου (floor plan of the
 * floor the space belongs to) when the space resolves to a floor doc. The
 * resolver is centralized in `resolveFloorId()` (SSoT).
 */
export interface ShowcaseLinkedSpaceFloorplanGroup {
  spaceId: string;
  allocationCode?: string;
  media: ShowcaseMedia[];
  floorFloorplans?: ShowcaseMedia[];
  floorLabel?: string;
}

export interface ShowcaseLinkedSpaceFloorplans {
  parking: ShowcaseLinkedSpaceFloorplanGroup[];
  storage: ShowcaseLinkedSpaceFloorplanGroup[];
}

/**
 * Floor-level floorplans attached to the property card (Phase 7.5). The
 * property resolves its floor via `resolveFloorId(property, floors)` (SSoT).
 */
export interface ShowcasePropertyFloorFloorplans {
  floorLabel?: string;
  media: ShowcaseMedia[];
}

export interface ShowcasePayload {
  property: ShowcasePropertySnapshot;
  company: ShowcaseCompanyBrand;
  photos: ShowcaseMedia[];
  floorplans: ShowcaseMedia[];
  propertyFloorFloorplans?: ShowcasePropertyFloorFloorplans;
  linkedSpaceFloorplans?: ShowcaseLinkedSpaceFloorplans;
  videoUrl?: string;
  pdfUrl?: string;
  expiresAt: string;
}
