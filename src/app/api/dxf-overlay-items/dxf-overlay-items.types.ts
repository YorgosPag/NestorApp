/**
 * 🔷 DXF OVERLAY ITEMS API — Response Types (ADR-289)
 *
 * Data payloads for the centralized `dxf-overlay-levels/{levelId}/items/{id}`
 * subcollection endpoint. Mirror of cad-files.types.ts / dxf-levels.types.ts.
 *
 * @see ADR-289 — DXF Overlay Item Centralization
 */

export type OverlayKindValue = 'property' | 'parking' | 'storage' | 'footprint';

export interface DxfOverlayItemDocument {
  id: string;
  levelId: string;
  kind: OverlayKindValue;
  polygon: Array<{ x: number; y: number }>;
  status?: string | null;
  label?: string | null;
  linked?: {
    propertyId?: string;
    parkingId?: string;
    storageId?: string;
  } | null;
  companyId: string | null;
  createdBy: string | null;
  [key: string]: unknown;
}

/** POST /api/dxf-overlay-items — create result payload */
export interface DxfOverlayItemCreateResponse {
  overlayId: string;
  levelId: string;
}

/** PUT /api/dxf-overlay-items — upsert (restore) result payload */
export interface DxfOverlayItemUpsertResponse {
  overlayId: string;
  levelId: string;
  created: boolean;
}

/** PATCH /api/dxf-overlay-items — update result payload */
export interface DxfOverlayItemUpdateResponse {
  success: true;
  overlayId: string;
  levelId: string;
  message: string;
}

/** DELETE /api/dxf-overlay-items — delete result payload */
export type DxfOverlayItemDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };

/** GET /api/dxf-overlay-items?levelId=... — list result payload */
export type DxfOverlayItemsListResponse =
  | {
      success: true;
      overlays: DxfOverlayItemDocument[];
      stats: { totalOverlays: number; levelId: string };
      message?: string;
    }
  | { success: false; error: string; details?: string };
