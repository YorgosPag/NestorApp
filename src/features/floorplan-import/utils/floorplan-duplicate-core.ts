/**
 * =============================================================================
 * 🏢 ENTERPRISE: Cross-Floor Floorplan Duplicate — Pure Core (ADR-465)
 * =============================================================================
 *
 * Pure, React-free helpers for the «Copy floorplan to another floor» feature.
 *
 * Design (ADR-465, v1 = option A): the duplicate re-feeds the ORIGINAL source
 * `.dxf` storage object through the EXISTING import pipeline (`uploadSmart`)
 * targeting the destination floor. These helpers cover only the two glue steps
 * the pipeline does not already own:
 *   1. {@link downloadFileRecordAsFile} — fetch a FileRecord's bytes back into a
 *      `File` (CORS-safe via the tokenized `downloadUrl`, same pattern proven in
 *      `FloorFloorplanService`).
 *   2. {@link buildFloorDuplicateConfig} — build the destination
 *      `FloorplanUploadConfig` exactly like the wizard's floor-level config.
 *
 * Everything else (wipe / generateFileId / storage path / dual-write / process /
 * thumbnail / dxfLevel) stays inside the canonical pipeline — ZERO duplication.
 *
 * @module features/floorplan-import/utils/floorplan-duplicate-core
 * @enterprise ADR-465 - Cross-Floor Floorplan Duplicate
 */

import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  type FileDomain,
  type FileCategory,
} from '@/config/domain-constants';
import { FLOORPLAN_PURPOSE_BY_TYPE } from '../hooks/floorplan-import-types';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal slice of a FileRecord needed to rehydrate its bytes into a File. */
export interface DownloadableFileRecord {
  downloadUrl?: string;
  originalFilename?: string;
  ext?: string;
}

/** Inputs for {@link buildFloorDuplicateConfig}. */
export interface FloorDuplicateConfigParams {
  companyId: string;
  projectId?: string;
  userId: string;
  /** Destination floor id (the copy target). */
  destFloorId: string;
  /** Human-readable destination floor label (for centralized displayName). */
  destFloorName?: string;
  /** Destination floor's building — wired as a `linkedTo` cross-entity link. */
  buildingId?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const DEFAULT_DXF_MIME = 'application/dxf';

/**
 * Downloads a FileRecord's stored bytes and wraps them back into a `File`,
 * ready to be re-fed into `uploadSmart`.
 *
 * Uses the tokenized Firebase `downloadUrl` which is CORS-fetchable from the
 * browser (the same client-side `fetch(downloadUrl)` pattern already used by
 * `FloorFloorplanService` to load DXF scenes).
 *
 * @throws Error('NO_DOWNLOAD_URL') when the record has no resolvable URL.
 * @throws Error('DOWNLOAD_FAILED_<status>') on a non-OK HTTP response.
 */
export async function downloadFileRecordAsFile(
  record: DownloadableFileRecord,
): Promise<File> {
  if (!record.downloadUrl) throw new Error('NO_DOWNLOAD_URL');

  const response = await fetch(record.downloadUrl);
  if (!response.ok) throw new Error(`DOWNLOAD_FAILED_${response.status}`);

  const blob = await response.blob();
  const ext = (record.ext || 'dxf').replace(/^\./, '');
  const name = record.originalFilename || `floorplan.${ext}`;
  return new File([blob], name, { type: blob.type || DEFAULT_DXF_MIME });
}

/**
 * Builds the destination-floor {@link FloorplanUploadConfig} — identical in
 * shape to the wizard's floor-level `uploadConfig` (entity floor + construction
 * domain + floorplans category + floor purpose), so the canonical pipeline
 * generates the correct storage path and `displayName` for the target floor.
 */
export function buildFloorDuplicateConfig(
  params: FloorDuplicateConfigParams,
): FloorplanUploadConfig {
  return {
    companyId: params.companyId,
    projectId: params.projectId,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: params.destFloorId,
    domain: FILE_DOMAINS.CONSTRUCTION as FileDomain,
    category: FILE_CATEGORIES.FLOORPLANS as FileCategory,
    userId: params.userId,
    entityLabel: params.destFloorName,
    purpose: FLOORPLAN_PURPOSE_BY_TYPE.floor,
    ...(params.buildingId ? { linkedTo: [`building:${params.buildingId}`] } : {}),
  };
}
