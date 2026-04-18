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
}

/**
 * Floorplan media grouped per linked parking/storage space.
 * Populated server-side by reading `files` for each linked space via
 * `listEntityMedia(entityType='parking'|'storage', entityId=<spaceId>)`.
 */
export interface ShowcaseLinkedSpaceFloorplanGroup {
  spaceId: string;
  allocationCode?: string;
  media: ShowcaseMedia[];
}

export interface ShowcaseLinkedSpaceFloorplans {
  parking: ShowcaseLinkedSpaceFloorplanGroup[];
  storage: ShowcaseLinkedSpaceFloorplanGroup[];
}

export interface ShowcasePayload {
  property: ShowcasePropertySnapshot;
  company: ShowcaseCompanyBrand;
  photos: ShowcaseMedia[];
  floorplans: ShowcaseMedia[];
  linkedSpaceFloorplans?: ShowcaseLinkedSpaceFloorplans;
  videoUrl?: string;
  pdfUrl?: string;
  expiresAt: string;
}
