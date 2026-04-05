'use client';

/**
 * 🔷 DXF OVERLAY ITEM MUTATION GATEWAY (ADR-289)
 *
 * Client-side wrapper for the centralized overlay-item endpoint. Mirror of
 * dxf-level-mutation-gateway.ts / cad-file-mutation-gateway.ts — single API
 * entry point for all overlay polygon mutations. No direct client-side
 * Firestore writes.
 *
 * All overlay writes MUST go through this gateway, which routes to
 * /api/dxf-overlay-items (server-side admin SDK with tenant enforcement).
 *
 * @see ADR-289 — DXF Overlay Item Centralization
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

export type OverlayKindValue = 'property' | 'parking' | 'storage' | 'footprint';

export interface OverlayLinkedPayload {
  propertyId?: string;
  parkingId?: string;
  storageId?: string;
}

export interface OverlayStylePayload {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

/** POST payload — server generates overlayId. */
export interface CreateOverlayItemPayload {
  levelId: string;
  kind: OverlayKindValue;
  polygon: Array<{ x: number; y: number }>;
  status?: string;
  label?: string;
  linked?: OverlayLinkedPayload;
  style?: OverlayStylePayload;
}

/** PUT payload — client-supplied overlayId (restore flow). */
export interface UpsertOverlayItemPayload {
  levelId: string;
  overlayId: string;
  kind: OverlayKindValue;
  polygon: Array<{ x: number; y: number }>;
  status?: string;
  label?: string;
  linked?: OverlayLinkedPayload;
  style?: OverlayStylePayload;
  createdAtMs?: number;
  createdBy?: string;
}

/** PATCH payload — partial update. */
export interface UpdateOverlayItemPayload {
  levelId: string;
  overlayId: string;
  polygon?: Array<{ x: number; y: number }>;
  kind?: OverlayKindValue;
  status?: string;
  label?: string;
  linked?: OverlayLinkedPayload | null;
  style?: OverlayStylePayload;
}

export interface CreateOverlayItemResult {
  overlayId: string;
  levelId: string;
}

export interface UpsertOverlayItemResult {
  overlayId: string;
  levelId: string;
  created: boolean;
}

export interface UpdateOverlayItemResult {
  success: true;
  overlayId: string;
  levelId: string;
  message: string;
}

export interface DeleteOverlayItemResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Create a brand new overlay polygon. Server generates the enterprise ID.
 */
export async function createOverlayItemWithPolicy(
  payload: CreateOverlayItemPayload
): Promise<CreateOverlayItemResult> {
  return apiClient.post<CreateOverlayItemResult>(
    API_ROUTES.DXF_OVERLAY_ITEMS.LIST,
    payload as unknown as Record<string, unknown>
  );
}

/**
 * Upsert (restore) an overlay with its original id. Used by the undo flow.
 */
export async function upsertOverlayItemWithPolicy(
  payload: UpsertOverlayItemPayload
): Promise<UpsertOverlayItemResult> {
  return apiClient.put<UpsertOverlayItemResult>(
    API_ROUTES.DXF_OVERLAY_ITEMS.LIST,
    payload as unknown as Record<string, unknown>
  );
}

/**
 * Partial update (polygon/kind/status/label/linked/style).
 * `linked: null` explicitly clears the link.
 */
export async function updateOverlayItemWithPolicy(
  payload: UpdateOverlayItemPayload
): Promise<UpdateOverlayItemResult> {
  return apiClient.patch<UpdateOverlayItemResult>(
    API_ROUTES.DXF_OVERLAY_ITEMS.LIST,
    payload as unknown as Record<string, unknown>
  );
}

/**
 * Delete an overlay by (levelId, overlayId).
 */
export async function deleteOverlayItemWithPolicy({
  levelId,
  overlayId,
}: {
  levelId: string;
  overlayId: string;
}): Promise<DeleteOverlayItemResult> {
  const qs = `?levelId=${encodeURIComponent(levelId)}&overlayId=${encodeURIComponent(overlayId)}`;
  return apiClient.delete<DeleteOverlayItemResult>(
    `${API_ROUTES.DXF_OVERLAY_ITEMS.LIST}${qs}`
  );
}
