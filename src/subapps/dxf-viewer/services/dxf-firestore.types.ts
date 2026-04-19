import type { Timestamp } from 'firebase/firestore';
import type { SceneModel } from '../types/scene';
import type { SecurityValidationResult } from '../security/DxfSecurityValidator';
import type { FileRecord } from '@/types/file-record';

/**
 * Optional entity context for dual-write to `files` collection.
 * Injected by callers that know the business context (building, floor, project).
 * When absent, the DXF save still works (cadFiles primary) but the `files`
 * record will use fallback values ('standalone', 'system').
 */
export interface DxfSaveContext {
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  floorId?: string;
  createdBy?: string;
  /** 🏢 ENTERPRISE: Canonical scene path (derived from FileRecord storagePath) */
  canonicalScenePath?: string;
  /**
   * 🏢 ADR-240: Entity type for the `files` collection dual-write record.
   * When absent, defaults to 'building' (backward compatibility).
   * Set to 'floor' when saving a floor-level DXF (e.g. Wizard import).
   */
  entityType?: 'project' | 'building' | 'floor' | 'property';
  /**
   * 🏢 ADR-240: File category for the `files` collection dual-write record.
   * When absent, defaults to 'drawings'. Set to 'floorplans' for floor plans.
   */
  filesCategory?: 'drawings' | 'floorplans';
  /**
   * 🏢 ADR-240: Purpose tag for the `files` collection dual-write record.
   * Aligns with FLOORPLAN_PURPOSES (e.g. 'floor-floorplan').
   */
  purpose?: string;
  /** Human-readable entity label for displayName generation (e.g., "Κτήριο Α", "ΣΟΦΙΤΑ") */
  entityLabel?: string;
  /**
   * 🏢 ADR-309 Phase 6: FileRecord ID from wizard upload.
   * Passed from StepUpload → WizardCompleteMeta → saveContext so that
   * linkSceneToLevel writes the correct sceneFileId to the Level document.
   */
  fileRecordId?: string;
}

export interface DxfFileMetadata {
  id: string;
  fileName: string;
  storageUrl: string; // Firebase Storage download URL
  /** 🏢 ENTERPRISE: Actual storage path (canonical or legacy) for reliable loading */
  storagePath?: string;
  lastModified: Timestamp;
  version: number;
  checksum?: string;
  sizeBytes?: number;
  entityCount?: number;
  /**
   * 🔒 TENANT SCOPING: Company (tenant) that owns this file — required by Firestore
   * rules for cross-user read access. Nullable for legacy docs; new writes always
   * populate from the authenticated user's companyId.
   */
  companyId?: string | null;
  /**
   * 🔒 TENANT SCOPING: Authenticated user that created/last-saved this file.
   * Used for ownership-based access checks in Firestore rules.
   */
  createdBy?: string | null;
  securityValidation?: {
    validatedAt: Timestamp;
    validationResults: SecurityValidationResult[];
    isSecure: boolean;
  };
}

export interface DxfFileRecord {
  id: string;
  fileName: string;
  scene: SceneModel; // For backward compatibility - will be removed later
  lastModified: Timestamp;
  version: number;
  checksum?: string;
}

// =============================================================================
// 🏢 ADR-292 Phase 3: FileRecord → DxfFileMetadata adapter
// =============================================================================
// Enables DXF Viewer to read from the canonical `files` collection instead of
// the deprecated `cadFiles` collection. Maps FileRecord fields to the
// DxfFileMetadata shape expected by dxf-firestore-storage.impl.ts.
// =============================================================================

/**
 * Map a FileRecord from the `files` collection to DxfFileMetadata.
 * Used by getFileMetadataImpl() after redirecting reads from cadFiles → files.
 */
export function mapFileRecordToDxfMetadata(
  record: FileRecord
): DxfFileMetadata {
  return {
    id: record.id,
    fileName: record.originalFilename || record.displayName || record.id,
    storageUrl: record.downloadUrl || '',
    storagePath: record.storagePath,
    // FileRecord.updatedAt can be Date, string, or Firestore Timestamp
    lastModified: toFirestoreTimestamp(record.updatedAt),
    version: record.revision ?? 1,
    sizeBytes: record.sizeBytes,
    entityCount: record.processedData?.sceneStats?.entityCount,
    companyId: record.companyId,
    createdBy: record.createdBy,
    // checksum + securityValidation not stored in FileRecord (non-critical)
  };
}

/** Convert various date representations to Firestore Timestamp shape */
function toFirestoreTimestamp(
  value: unknown
): Timestamp {
  // Already a Firestore Timestamp (has toMillis)
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return value as Timestamp;
  }
  // Date object or string → create Timestamp-like object
  const ms = value instanceof Date
    ? value.getTime()
    : typeof value === 'string'
      ? new Date(value).getTime()
      : Date.now();

  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toDate: () => new Date(ms),
    toMillis: () => ms,
    isEqual: (other: Timestamp) => other.toMillis() === ms,
    valueOf: () => `Timestamp(seconds=${Math.floor(ms / 1000)}, nanoseconds=${(ms % 1000) * 1_000_000})`,
    toJSON: () => ({ seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1_000_000 }),
  } as Timestamp;
}
