/**
 * 🔷 FLOORPLAN OVERLAYS API — Response Types (ADR-340 Phase 9)
 *
 * Payload types for the multi-kind `floorplan_overlays` Firestore collection.
 * Mirror of dxf-overlay-items.types.ts.
 */

import type {
  OverlayGeometry,
  OverlayLinked,
  OverlayRole,
  OverlayStyle,
} from '@/types/floorplan-overlays';

export interface FloorplanOverlayDocument {
  id: string;
  companyId: string;
  backgroundId: string;
  floorId: string;
  geometry: OverlayGeometry;
  role: OverlayRole;
  linked?: OverlayLinked | null;
  label?: string | null;
  style?: OverlayStyle | null;
  layer?: string | null;
  createdBy: string;
  [key: string]: unknown;
}

/** POST /api/floorplan-overlays — create result payload */
export interface FloorplanOverlayCreateResponse {
  overlayId: string;
}

/** PUT /api/floorplan-overlays — upsert (restore) result payload */
export interface FloorplanOverlayUpsertResponse {
  overlayId: string;
  created: boolean;
}

/** PATCH /api/floorplan-overlays — update result payload */
export interface FloorplanOverlayUpdateResponse {
  success: true;
  overlayId: string;
  message: string;
}

/** DELETE /api/floorplan-overlays — delete result payload */
export type FloorplanOverlayDeleteResponse =
  | { success: true; message: string }
  | { success: false; error: string; details?: string };

/** GET /api/floorplan-overlays?floorId=... or ?backgroundId=... — list payload */
export type FloorplanOverlaysListResponse =
  | {
      success: true;
      overlays: FloorplanOverlayDocument[];
      stats: { totalOverlays: number; floorId?: string; backgroundId?: string };
      message?: string;
    }
  | { success: false; error: string; details?: string };
