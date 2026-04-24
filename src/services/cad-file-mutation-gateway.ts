'use client';

/**
 * 📐 CAD FILE MUTATION GATEWAY (ADR-288)
 *
 * Client-side wrapper for the centralized cadFiles metadata endpoint. Mirror of
 * dxf-level-mutation-gateway.ts / floor-mutation-gateway.ts — single API entry
 * point, no client-side Firestore writes.
 *
 * All cadFiles metadata writes MUST go through this gateway, which routes to
 * /api/cad-files (server-side upsert pipeline with dual-write to `files`).
 *
 * @see ADR-288 — CAD File Metadata Centralization
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

/** Optional entity-link context for the `files` dual-write (ADR-240). */
export interface CadFileContextPayload {
  projectId?: string;
  buildingId?: string;
  floorId?: string;
  entityType?: 'project' | 'building' | 'floor' | 'property';
  filesCategory?: 'drawings' | 'floorplans';
  purpose?: string;
  entityLabel?: string;
  canonicalScenePath?: string;
}

export interface CadFileSecurityValidationPayload {
  validationResults: Array<{ isValid: boolean; [key: string]: unknown }>;
  isSecure: boolean;
}

export interface UpsertCadFilePayload {
  fileId: string;
  fileName: string;
  storageUrl: string;
  storagePath: string;
  sizeBytes: number;
  entityCount: number;
  checksum?: string;
  securityValidation?: CadFileSecurityValidationPayload;
  context?: CadFileContextPayload;
}

/** Unwrapped result payload from POST /api/cad-files (data field of envelope). */
export interface CadFileUpsertResult {
  fileId: string;
  version: number;
  created: boolean;
}

export interface CadFileMetadataLookup {
  id: string;
  fileName: string;
  storageUrl: string;
  storagePath: string;
  sizeBytes: number;
  entityCount: number;
  version: number;
  checksum?: string;
  companyId?: string;
  createdBy?: string;
  [key: string]: unknown;
}

/**
 * Upsert cadFile metadata via /api/cad-files POST.
 * The server computes version + handles create-vs-update internally using the
 * supplied fileId. Returns the unwrapped payload; throws on HTTP/contract
 * failure (handled by enterprise-api-client).
 */
export async function upsertCadFileWithPolicy(
  payload: UpsertCadFilePayload
): Promise<CadFileUpsertResult> {
  return apiClient.post<CadFileUpsertResult>(
    API_ROUTES.CAD_FILES.LIST,
    payload as unknown as Record<string, unknown>
  );
}
