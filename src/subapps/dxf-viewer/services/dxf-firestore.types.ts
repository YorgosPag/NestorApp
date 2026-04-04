import type { Timestamp } from 'firebase/firestore';
import type { SceneModel } from '../types/scene';
import type { SecurityValidationResult } from '../security/DxfSecurityValidator';

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
  entityType?: 'building' | 'floor' | 'property';
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
