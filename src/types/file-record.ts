/**
 * =============================================================================
 * FILE RECORD - ENTERPRISE CANONICAL CONTRACT
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Firestore document contract for the `files` collection.
 * This is the Source of Truth for file metadata - Storage holds binaries only.
 *
 * @module types/file-record
 * @enterprise ADR-031 - Canonical File Storage System
 * @see local_ΔΙΚΑΙΩΜΑΤΑ.txt - Enterprise File Storage Architecture
 *
 * Architecture:
 * - Firebase Storage = binary files (IDs-only paths)
 * - Firestore `files` = metadata, relationships, display names
 */

import type {
  EntityType,
  FileDomain,
  FileCategory,
  FileStatus,
  FileLifecycleState,
  HoldType,
} from '@/config/domain-constants';

// ============================================================================
// 🏢 ENTERPRISE: FLOORPLAN PROCESSED DATA TYPES (ADR-033)
// ============================================================================
// Cached processed data for floorplan files (DXF, PDF).
// Original files remain in Storage - this is render-ready cached data.
// Pattern: Autodesk Viewer (DWG + preview), Google Docs (file + cached render)
// ============================================================================

/**
 * 🏢 ENTERPRISE: DXF Scene Entity
 * Represents a single CAD entity (line, polyline, circle, arc, text)
 */
export interface DxfSceneEntity {
  /** Entity type (line, polyline, circle, arc, text, etc.) */
  type: string;
  /** Layer name this entity belongs to */
  layer: string;
  /** Additional entity-specific properties */
  [key: string]: unknown;
}

/**
 * 🏢 ENTERPRISE: DXF Scene Layer
 * Represents a CAD layer with visibility and color
 */
export interface DxfSceneLayer {
  /** Layer name */
  name: string;
  /** Layer color (hex or CAD color index) */
  color?: string;
  /** Layer visibility */
  visible?: boolean;
}

/**
 * 🏢 ENTERPRISE: DXF Scene Bounds
 * Bounding box of the entire drawing
 */
export interface DxfSceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

/**
 * 🏢 ENTERPRISE: Parsed DXF Scene Data
 * Complete parsed representation of a DXF file
 */
export interface DxfSceneData {
  /** All entities in the drawing */
  entities: DxfSceneEntity[];
  /** Layer definitions */
  layers: Record<string, DxfSceneLayer>;
  /** Drawing bounds for viewport calculations */
  bounds?: DxfSceneBounds;
}

/**
 * 🏢 ENTERPRISE: Floorplan file type discriminator
 */
export type FloorplanFileType = 'dxf' | 'pdf';

/**
 * 🏢 ENTERPRISE: Cached Processed Data for Floorplans
 *
 * Stored in FileRecord.processedData for floorplan files.
 * Eliminates re-parsing on every view while keeping original in Storage.
 *
 * ARCHITECTURE (Enterprise Pattern - Autodesk/Bentley):
 * - Firestore: Metadata only (~1KB) - paths, timestamps, stats
 * - Storage: Processed JSON file (~100KB-5MB) - actual scene data
 * - Client: Fetches JSON on-demand from Storage
 *
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 */
export interface FloorplanProcessedData {
  /** File type discriminator */
  fileType: FloorplanFileType;

  // =========================================================================
  // 🏢 ENTERPRISE: STORAGE-BASED ARCHITECTURE (V2)
  // =========================================================================
  // Scene data is stored in Storage, NOT Firestore (prevents 1MB limit issues)
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Path to processed JSON in Storage
   * The actual scene data is stored here, NOT in Firestore
   * Format: {storagePath}.processed.json
   */
  processedDataPath?: string;

  /**
   * 🏢 ENTERPRISE: Download URL for processed JSON
   * Client fetches this URL to load the scene data
   */
  processedDataUrl?: string;

  // =========================================================================
  // METADATA (stored in Firestore - small footprint)
  // =========================================================================

  /**
   * Scene statistics (for UI display without loading full scene)
   */
  sceneStats?: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };

  /**
   * Drawing bounds for viewport calculations
   * Small enough to store in Firestore
   */
  bounds?: DxfSceneBounds;

  /**
   * @deprecated V1: Scene was stored directly in Firestore (caused 1MB limit issues)
   * V2: Scene is now stored in Storage at processedDataPath
   * Kept for backward compatibility with existing records
   */
  scene?: DxfSceneData;

  /**
   * Cached PDF thumbnail/preview URL
   * Only populated when fileType === 'pdf'
   * Can be a data URL or Storage URL to rendered preview
   */
  pdfPreviewUrl?: string;

  /**
   * PDF page dimensions (for aspect ratio calculations)
   * Only populated when fileType === 'pdf'
   */
  pdfDimensions?: {
    width: number;
    height: number;
  };

  /** Timestamp when data was processed (for cache invalidation) */
  processedAt: number;

  /** Original file size before compression (bytes) */
  originalSize?: number;

  /** Processed JSON file size (bytes) */
  processedSize?: number;

  /** Encoding used to decode the DXF file */
  encoding?: string;
}

// ============================================================================
// CORE FILE RECORD CONTRACT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Canonical FileRecord interface for Firestore boundary
 *
 * This interface defines the contract for documents in the `files` collection.
 * All file uploads MUST create a FileRecord as the source of truth.
 *
 * @example
 * ```typescript
 * const fileRecord: FileRecord = {
 *   id: 'file_abc123',
 *   companyId: 'company_xyz',
 *   projectId: 'project_456',
 *   entityType: 'contact',
 *   entityId: 'contact_789',
 *   domain: 'admin',
 *   category: 'photos',
 *   storagePath: 'companies/xyz/projects/456/entities/contact/789/domains/admin/categories/photos/files/abc123.jpg',
 *   displayName: 'Φωτογραφία Προφίλ - Γιώργος Παπαδόπουλος',
 *   originalFilename: 'IMG_20240115_photo.jpg',
 *   ext: 'jpg',
 *   contentType: 'image/jpeg',
 *   sizeBytes: 245760,
 *   status: 'ready',
 *   createdAt: Timestamp,
 *   createdBy: 'user_abc',
 * };
 * ```
 */
export interface FileRecord {
  /** Unique file identifier (generated) */
  id: string;

  // =========================================================================
  // TENANT & SCOPE (Multi-tenant support)
  // =========================================================================

  /** Company ID for tenant isolation (optional for system files) */
  companyId?: string;

  /** Project ID for project-scoped files (optional) */
  projectId?: string;

  // =========================================================================
  // ENTITY RELATIONSHIP
  // =========================================================================

  /**
   * Type of entity this file belongs to
   * @see ENTITY_TYPES in domain-constants.ts
   */
  entityType: EntityType;

  /** ID of the entity this file belongs to */
  entityId: string;

  // =========================================================================
  // CLASSIFICATION
  // =========================================================================

  /**
   * Business domain (admin, construction, sales, accounting)
   * @see FILE_DOMAINS in domain-constants.ts
   */
  domain: FileDomain;

  /**
   * Content category (photos, floorplans, documents, etc.)
   * @see FILE_CATEGORIES in domain-constants.ts
   */
  category: FileCategory;

  // =========================================================================
  // STORAGE REFERENCE
  // =========================================================================

  /**
   * Full path in Firebase Storage (IDs only, no Greek names)
   * Generated by buildStoragePath()
   */
  storagePath: string;

  /**
   * Download URL from Firebase Storage (populated after upload)
   * @optional - May not be present for pending files
   */
  downloadUrl?: string;

  // =========================================================================
  // DISPLAY & ORIGINAL INFO
  // =========================================================================

  /**
   * Human-readable display name (Greek/any language)
   * Used in UI and exports, NOT in storage path
   */
  displayName: string;

  /**
   * Original filename as uploaded by user
   * Preserved for reference/download
   */
  originalFilename: string;

  // =========================================================================
  // FILE METADATA
  // =========================================================================

  /** File extension without dot (jpg, pdf, dxf, etc.) */
  ext: string;

  /** MIME type (image/jpeg, application/pdf, etc.) */
  contentType: string;

  /** File size in bytes (populated after finalize) */
  sizeBytes?: number;

  // =========================================================================
  // STATUS & LIFECYCLE
  // =========================================================================

  /**
   * Current file status
   * @see FILE_STATUS in domain-constants.ts
   */
  status: FileStatus;

  // =========================================================================
  // AUDIT FIELDS
  // =========================================================================

  /** Creation timestamp (Firestore Timestamp or ISO string) */
  createdAt: Date | string;

  /** User ID who created this file */
  createdBy: string;

  /** Last update timestamp */
  updatedAt?: Date | string;

  // =========================================================================
  // OPTIONAL ADVANCED FIELDS
  // =========================================================================

  /** Content hash for deduplication (optional) */
  hash?: string;

  /** Version/revision number for versioned files */
  revision?: number;

  /**
   * 🏢 ENTERPRISE: Entry point ID used during upload
   * @see UPLOAD_ENTRY_POINTS in upload-entry-points.ts
   */
  entryPointId?: string;

  /**
   * 🏢 ENTERPRISE: Purpose/descriptor for file filtering
   * e.g., "profile", "front", "signed", "project-floorplan", "parking-floorplan"
   * Used for filtering files within the same category by specific purpose
   */
  purpose?: string;

  // =========================================================================
  // 🏢 ENTERPRISE: INGESTION SOURCE TRACKING (ADR-055)
  // =========================================================================
  // For files received from external sources (Telegram, Email, WhatsApp)
  // Enables traceability and deduplication
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: External source metadata
   * Tracks where this file originated from (Telegram, Email, WhatsApp, etc.)
   * Used for:
   * - Traceability: trace file back to original conversation/message
   * - Deduplication: fileUniqueId for Telegram prevents re-processing same file
   * - Audit: complete chain of custody from source to classification
   *
   * @enterprise ADR-055 - Enterprise Attachment Ingestion System
   */
  source?: {
    /** Source type (telegram, email, whatsapp, web-form, etc.) */
    type: 'telegram' | 'email' | 'whatsapp' | 'web-form' | 'api';
    /** Chat/conversation ID from source platform */
    chatId?: string;
    /** Message ID from source platform */
    messageId?: string;
    /** User ID from source platform (sender) */
    fromUserId?: string;
    /** Telegram file_unique_id for deduplication (stable across bots/time) */
    fileUniqueId?: string;
    /** Telegram file_id for download (may change) */
    fileId?: string;
    /** Original sender display name */
    senderName?: string;
    /** Timestamp when received from source */
    receivedAt?: Date | string;
  };

  /**
   * 🏢 ENTERPRISE: Ingestion state for quarantine/classification workflow
   * Only present for files in INGESTION domain
   *
   * State machine:
   * - received: File uploaded, awaiting scan
   * - scanned: Passed security scan, awaiting classification
   * - classified: User has assigned to business entity, ready for promotion
   *
   * @enterprise ADR-055 - Enterprise Attachment Ingestion System
   */
  ingestion?: {
    /** Current ingestion state */
    state: 'received' | 'scanned' | 'classified';
    /** When state last changed */
    stateChangedAt?: Date | string;
    /** Security scan result (if scanned) */
    scanResult?: {
      passed: boolean;
      scannedAt: Date | string;
      scannerVersion?: string;
      threats?: string[];
    };
  };

  // =========================================================================
  // 🏢 ENTERPRISE: CLASSIFICATION AUDIT (ADR-055)
  // =========================================================================
  // When a file is promoted from INGESTION to a business entity,
  // we track who classified it and when for audit trail
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Classification audit fields
   * Populated when file is promoted from INGESTION to business entity
   *
   * @enterprise ADR-055 - Enterprise Attachment Ingestion System
   */
  classifiedAt?: Date | string;

  /** User who classified/promoted this file */
  classifiedBy?: string;

  /**
   * Original ingestion path before promotion
   * Kept for audit trail - shows where file was before classification
   */
  originalIngestionPath?: string;

  // =========================================================================
  // 🏢 ENTERPRISE: PROCESSED DATA - FLOORPLAN CACHING (ADR-033)
  // =========================================================================
  // For floorplan files (DXF, PDF), we cache processed data to avoid
  // re-parsing on every view. Original file remains in Storage as SSoT.
  // Pattern: Google Docs (file + cached render), Autodesk (DWG + preview)
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Cached processed data for special file types
   *
   * Used for floorplans (DXF/PDF) to cache parsed scene data.
   * Original file remains in Storage - this is just a cached representation.
   *
   * @enterprise ADR-033 - Floorplan Processing Pipeline
   */
  processedData?: FloorplanProcessedData;

  // =========================================================================
  // 🗑️ ENTERPRISE TRASH SYSTEM - LIFECYCLE FIELDS
  // =========================================================================
  // 3-tier lifecycle: Active → Trashed → Archived → Purged
  // @enterprise ADR-032 - Enterprise Trash System
  // =========================================================================

  /**
   * Current lifecycle state
   * @default 'active' for new files
   * @see FILE_LIFECYCLE_STATES in domain-constants.ts
   */
  lifecycleState?: FileLifecycleState;

  // -------------------------------------------------------------------------
  // TRASH FIELDS (when lifecycleState === 'trashed')
  // -------------------------------------------------------------------------

  /** Soft delete flag (legacy compatibility + Firestore query optimization) */
  isDeleted?: boolean;

  /** When file was moved to trash */
  trashedAt?: Date | string;

  /** User who moved file to trash */
  trashedBy?: string;

  /**
   * When file becomes eligible for permanent deletion
   * Calculated: trashedAt + retentionDays
   * @enterprise Server-side scheduler checks this field
   */
  purgeAt?: Date | string;

  // -------------------------------------------------------------------------
  // RETENTION & HOLD FIELDS (compliance/legal)
  // -------------------------------------------------------------------------

  /**
   * Retention policy end date
   * File cannot be purged before this date (even if purgeAt passed)
   * @enterprise For regulatory compliance (tax records, legal documents)
   */
  retentionUntil?: Date | string;

  /**
   * Hold type preventing deletion
   * @see HOLD_TYPES in domain-constants.ts
   * @enterprise Legal/regulatory holds block purge regardless of purgeAt
   */
  hold?: HoldType;

  /**
   * Who placed the hold
   * @enterprise Audit trail for compliance
   */
  holdPlacedBy?: string;

  /**
   * When hold was placed
   * @enterprise Audit trail for compliance
   */
  holdPlacedAt?: Date | string;

  /**
   * Reason for hold (free text)
   * @enterprise Documentation for legal/compliance
   */
  holdReason?: string;

  // -------------------------------------------------------------------------
  // ARCHIVE FIELDS (when lifecycleState === 'archived')
  // -------------------------------------------------------------------------

  /** When file was archived */
  archivedAt?: Date | string;

  /** User who archived the file */
  archivedBy?: string;

  /** Reason for archival */
  archiveReason?: string;

  // -------------------------------------------------------------------------
  // LEGACY COMPATIBILITY (deprecated, use trashedAt/trashedBy)
  // -------------------------------------------------------------------------

  /**
   * @deprecated Use trashedAt instead
   * Kept for backward compatibility with existing queries
   */
  deletedAt?: Date | string;

  /**
   * @deprecated Use trashedBy instead
   * Kept for backward compatibility with existing queries
   */
  deletedBy?: string;
}

// ============================================================================
// INPUT TYPES (for creating FileRecords)
// ============================================================================

/**
 * Input for creating a pending FileRecord (Step A of upload flow)
 *
 * 🏢 ENTERPRISE: displayName is NOT accepted as raw input.
 * Instead, provide "naming context" and the system generates displayName centrally.
 * This enforces single naming authority (ADR-031).
 */
export interface CreateFileRecordInput {
  /** Company ID for tenant isolation (REQUIRED for multi-tenant) */
  companyId: string;
  /** Project ID for project scope */
  projectId?: string;
  /** Entity type this file belongs to */
  entityType: EntityType;
  /** Entity ID this file belongs to */
  entityId: string;
  /** Business domain */
  domain: FileDomain;
  /** Content category */
  category: FileCategory;

  // =========================================================================
  // NAMING CONTEXT (used to generate displayName centrally)
  // =========================================================================

  /**
   * Human-readable entity label (e.g., "Γιώργος Παπαδόπουλος", "Κτίριο Α")
   * Used by central naming builder to generate displayName
   */
  entityLabel?: string;

  /**
   * Purpose/descriptor (e.g., "profile", "front", "signed", "draft")
   * Used by central naming builder
   */
  purpose?: string;

  /**
   * Additional descriptors (e.g., ["1ος Όροφος", "Διαμέρισμα 1"])
   * Used by central naming builder
   */
  descriptors?: string[];

  /**
   * Date when file was created/occurred (for naming)
   */
  occurredAt?: Date;

  /**
   * Revision number if versioned file
   */
  revision?: number;

  /**
   * 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
   * When provided, replaces category+purpose in display name
   */
  customTitle?: string;

  // =========================================================================
  // FILE METADATA
  // =========================================================================

  /** Original filename from upload */
  originalFilename: string;
  /** File extension */
  ext?: string;
  /** MIME type */
  contentType: string;
  /** User creating the file */
  createdBy: string;
}

/**
 * Result from creating a pending FileRecord
 */
export interface CreateFileRecordResult {
  /** Generated file ID */
  fileId: string;
  /** Generated storage path */
  storagePath: string;
  /** Display name for UI */
  displayName: string;
  /** The created FileRecord */
  fileRecord: FileRecord;
}

/**
 * Input for finalizing a FileRecord (Step C of upload flow)
 */
export interface FinalizeFileRecordInput {
  /** File ID to finalize */
  fileId: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Download URL from Storage */
  downloadUrl: string;
  /** Content hash (optional) */
  hash?: string;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Parameters for querying FileRecords
 */
export interface FileRecordQuery {
  /** Filter by company */
  companyId?: string;
  /** Filter by project */
  projectId?: string;
  /** Filter by entity type */
  entityType?: EntityType;
  /** Filter by entity ID */
  entityId?: string;
  /** Filter by domain */
  domain?: FileDomain;
  /** Filter by category */
  category?: FileCategory;
  /** Filter by status */
  status?: FileStatus;
  /** Include soft-deleted files */
  includeDeleted?: boolean;
  /** Maximum results */
  limit?: number;
  /** Pagination cursor */
  startAfter?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an object is a valid FileRecord
 */
export function isFileRecord(obj: unknown): obj is FileRecord {
  if (typeof obj !== 'object' || obj === null) return false;

  const record = obj as Partial<FileRecord>;

  return (
    typeof record.id === 'string' &&
    typeof record.entityType === 'string' &&
    typeof record.entityId === 'string' &&
    typeof record.domain === 'string' &&
    typeof record.category === 'string' &&
    typeof record.storagePath === 'string' &&
    typeof record.displayName === 'string' &&
    typeof record.originalFilename === 'string' &&
    typeof record.ext === 'string' &&
    typeof record.contentType === 'string' &&
    typeof record.status === 'string' &&
    typeof record.createdBy === 'string'
  );
}
