'use client';

/**
 * =============================================================================
 * Floorplan Background API Client (typed wrapper, Phase 7)
 * =============================================================================
 *
 * Thin browser-side wrapper around the `/api/floorplan-backgrounds` routes.
 * Uses the canonical EnterpriseApiClient for auth + retries + telemetry.
 *
 * @module subapps/dxf-viewer/floorplan-background/services/floorplan-background-api-client
 * @enterprise ADR-340 Phase 7
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  FloorplanBackground,
  BackgroundTransform,
  CalibrationData,
  ProviderId,
  ProviderMetadata,
} from '../providers/types';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface FloorPolygonState {
  floorplanOverlayCount: number;
  total: number;
}

export interface GetByFloorResponse {
  background: FloorplanBackground | null;
  polygonState: FloorPolygonState | null;
  fileRecord: { id: string; downloadUrl: string | null } | null;
}

export interface UploadResponse {
  background: FloorplanBackground;
  fileRecord: { id: string; downloadUrl: string };
}

export interface PatchResponse {
  background: FloorplanBackground;
}

export interface PatchCalibrationResponse extends PatchResponse {
  remap: { overlaysRemapped: number; atomicWithBackground: boolean };
}

export interface DeleteResponse {
  deleted: boolean;
  overlaysDeleted: number;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface UploadInput {
  file: File;
  floorId: string;
  projectId?: string;
  providerId: ProviderId;
  naturalWidth: number;
  naturalHeight: number;
  providerMetadata?: ProviderMetadata;
}

export interface PatchTransformInput {
  transform?: Partial<BackgroundTransform>;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

export interface PatchCalibrationInput {
  oldTransform: BackgroundTransform;
  newTransform: BackgroundTransform;
  calibration: CalibrationData;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const BASE = '/api/floorplan-backgrounds';

export const FloorplanBackgroundApiClient = {
  async getByFloor(floorId: string, opts?: { includePolygonState?: boolean }): Promise<GetByFloorResponse> {
    const params = new URLSearchParams({ floorId });
    if (opts?.includePolygonState) params.set('include', 'polygonState');
    return apiClient.get<GetByFloorResponse>(`${BASE}?${params.toString()}`);
  },

  async upload(input: UploadInput): Promise<UploadResponse> {
    const fd = new FormData();
    fd.set('file', input.file);
    fd.set('floorId', input.floorId);
    fd.set('providerId', input.providerId);
    fd.set('naturalWidth', String(input.naturalWidth));
    fd.set('naturalHeight', String(input.naturalHeight));
    if (input.projectId) fd.set('projectId', input.projectId);
    if (input.providerMetadata) fd.set('providerMetadata', JSON.stringify(input.providerMetadata));
    return apiClient.post<UploadResponse>(BASE, fd);
  },

  async patchTransform(id: string, input: PatchTransformInput): Promise<PatchResponse> {
    return apiClient.patch<PatchResponse>(`${BASE}/${encodeURIComponent(id)}`, {
      kind: 'transform',
      ...input,
    });
  },

  async patchCalibration(id: string, input: PatchCalibrationInput): Promise<PatchCalibrationResponse> {
    return apiClient.patch<PatchCalibrationResponse>(`${BASE}/${encodeURIComponent(id)}`, {
      kind: 'calibration',
      oldTransform: input.oldTransform,
      newTransform: input.newTransform,
      calibration: input.calibration,
    });
  },

  async delete(id: string): Promise<DeleteResponse> {
    return apiClient.delete<DeleteResponse>(`${BASE}/${encodeURIComponent(id)}`);
  },
};
