'use client';

/**
 * 🔷 FLOORPLAN OVERLAY MUTATION GATEWAY (ADR-340 Phase 9)
 *
 * Client-side wrapper for the centralized multi-kind overlay endpoint at
 * /api/floorplan-overlays. Replaces direct client Firestore writes for the
 * `floorplan_overlays` collection. Mirror of `dxf-overlay-item-mutation-gateway.ts`.
 *
 * All overlay writes from FloorplanGallery + DXF Viewer subapp MUST flow
 * through this gateway. Pre-commit hook (CHECK 3.7 / SSoT registry module
 * `floorplan-overlay-gateway`) blocks ad-hoc writes.
 *
 * @see ADR-340 — Floorplan Background System (Phase 9 — Multi-Kind Overlays)
 * @see src/types/floorplan-overlays.ts — schema SSoT
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  OverlayGeometry,
  OverlayLinked,
  OverlayRole,
  OverlayStyle,
} from '@/types/floorplan-overlays';

// ─── Payloads ─────────────────────────────────────────────────────────────────

/** POST payload — server generates overlayId. */
export interface CreateFloorplanOverlayPayload {
  backgroundId: string;
  floorId: string;
  geometry: OverlayGeometry;
  role: OverlayRole;
  linked?: OverlayLinked;
  label?: string;
  style?: OverlayStyle;
  layer?: string;
}

/** PUT payload — client-supplied overlayId (restore flow). */
export interface UpsertFloorplanOverlayPayload {
  overlayId: string;
  backgroundId: string;
  floorId: string;
  geometry: OverlayGeometry;
  role: OverlayRole;
  linked?: OverlayLinked;
  label?: string;
  style?: OverlayStyle;
  layer?: string;
  createdAtMs?: number;
  createdBy?: string;
}

/** PATCH payload — partial update. `null` explicitly clears optional fields. */
export interface UpdateFloorplanOverlayPayload {
  overlayId: string;
  geometry?: OverlayGeometry;
  role?: OverlayRole;
  linked?: OverlayLinked | null;
  label?: string | null;
  style?: OverlayStyle | null;
  layer?: string | null;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface CreateFloorplanOverlayResult {
  overlayId: string;
}

export interface UpsertFloorplanOverlayResult {
  overlayId: string;
  created: boolean;
}

export interface UpdateFloorplanOverlayResult {
  success: true;
  overlayId: string;
  message: string;
}

export interface DeleteFloorplanOverlayResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Operations ───────────────────────────────────────────────────────────────

/** Create a new overlay. Server generates enterprise ID + stamps companyId. */
export async function createFloorplanOverlay(
  payload: CreateFloorplanOverlayPayload,
): Promise<CreateFloorplanOverlayResult> {
  return apiClient.post<CreateFloorplanOverlayResult>(
    API_ROUTES.FLOORPLAN_OVERLAYS.LIST,
    payload as unknown as Record<string, unknown>,
  );
}

/** Upsert (restore) an overlay with its original id. Used by undo. */
export async function upsertFloorplanOverlay(
  payload: UpsertFloorplanOverlayPayload,
): Promise<UpsertFloorplanOverlayResult> {
  return apiClient.put<UpsertFloorplanOverlayResult>(
    API_ROUTES.FLOORPLAN_OVERLAYS.LIST,
    payload as unknown as Record<string, unknown>,
  );
}

/** Partial update; `linked: null`/`label: null` etc. clear the field. */
export async function updateFloorplanOverlay(
  payload: UpdateFloorplanOverlayPayload,
): Promise<UpdateFloorplanOverlayResult> {
  return apiClient.patch<UpdateFloorplanOverlayResult>(
    API_ROUTES.FLOORPLAN_OVERLAYS.LIST,
    payload as unknown as Record<string, unknown>,
  );
}

/** Delete by overlayId. */
export async function deleteFloorplanOverlay({
  overlayId,
}: {
  overlayId: string;
}): Promise<DeleteFloorplanOverlayResult> {
  return apiClient.delete<DeleteFloorplanOverlayResult>(
    `${API_ROUTES.FLOORPLAN_OVERLAYS.LIST}?overlayId=${encodeURIComponent(overlayId)}`,
  );
}
