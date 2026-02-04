/**
 * =============================================================================
 * 🏢 ENTERPRISE: FILE RECORD CORE - SSoT FOR FILE RECORD SCHEMA
 * =============================================================================
 *
 * Pure module for FileRecord creation - NO SDK DEPENDENCIES.
 * Used by both client (FileRecordService) and server (Telegram webhook).
 *
 * This is the SINGLE SOURCE OF TRUTH for FileRecord schema construction.
 * SDK-specific operations (timestamps, writes) happen in adapters.
 *
 * @module services/file-record/file-record-core
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 *
 * Architecture:
 * - Core: Pure functions for schema construction (this file)
 * - Client Adapter: FileRecordService uses firebase/firestore
 * - Server Adapter: Webhook uses firebase-admin
 */

import type {
  EntityType,
  FileDomain,
  FileCategory,
  FileStatus,
  FileLifecycleState,
} from '@/config/domain-constants';
import type { DocumentClassifyAnalysis } from '@/schemas/ai-analysis';
import {
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
} from '@/config/domain-constants';
// 🏢 ENTERPRISE (2026-01-31): Direct imports to avoid barrel file
// The barrel '@/services/upload' re-exports pdf-utils which imports react-i18next
// This breaks API routes with "createContext is not a function" error
import {
  buildStoragePath,
  generateFileId,
  getFileExtension,
} from '@/services/upload/utils/storage-path';
import {
  buildFileDisplayName,
  type FileDisplayNameResult,
} from '@/services/upload/utils/file-display-name';

// ============================================================================
// TYPES - INPUT/OUTPUT CONTRACTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Source metadata for files from external systems
 * Used for traceability and deduplication (Telegram, Email, etc.)
 * MUST match FileRecord.source type in types/file-record.ts
 */
export interface FileSourceMetadata {
  /** Source system identifier */
  type: 'telegram' | 'email' | 'whatsapp' | 'web-form' | 'api';
  /** Chat/conversation ID (for Telegram) */
  chatId?: string;
  /** Message ID from source system */
  messageId?: string;
  /** Unique file ID from source (for deduplication) */
  fileUniqueId?: string;
  /** Telegram file_id for download (may change) */
  fileId?: string;
  /** User ID from source system */
  fromUserId?: string;
  /** Sender name for display */
  senderName?: string;
  /** When the file was received */
  receivedAt?: Date | string;
}

/**
 * 🏢 ENTERPRISE: Ingestion state for quarantine pipeline
 * MUST match FileRecord.ingestion type in types/file-record.ts
 */
export interface IngestionState {
  /** Current state in ingestion pipeline */
  state: 'received' | 'scanned' | 'classified';
  /** When state was last changed */
  stateChangedAt?: Date | string;
  /** Security scan result (if scanned) */
  scanResult?: {
    passed: boolean;
    scannedAt: Date | string;
    scannerVersion?: string;
    threats?: string[];
  };
  /** AI document classification (if available) */
  analysis?: DocumentClassifyAnalysis;
}

/**
 * 🏢 ENTERPRISE: Input for building pending FileRecord data
 * Pure input - no SDK types allowed
 */
export interface BuildPendingFileRecordInput {
  // Required fields
  companyId: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  originalFilename: string;
  contentType: string;
  createdBy: string;

  // Optional fields
  projectId?: string;
  ext?: string;

  // Naming context (for displayName generation)
  entityLabel?: string;
  purpose?: string;
  descriptors?: string[];
  occurredAt?: Date;
  revision?: number;
  customTitle?: string;

  // Source metadata (for external ingestion)
  source?: FileSourceMetadata;

  // Ingestion state (for quarantine pipeline)
  ingestion?: IngestionState;

  // Language for display name
  language?: 'el' | 'en';
}

/**
 * 🏢 ENTERPRISE: Base FileRecord fields (deterministic, no timestamps)
 * SDK adapters add timestamps and write to DB
 */
export interface FileRecordBase {
  id: string;
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  storagePath: string;
  displayName: string;
  originalFilename: string;
  ext: string;
  contentType: string;
  status: FileStatus;
  lifecycleState?: FileLifecycleState;
  isDeleted?: boolean;
  createdBy: string;

  // Optional naming metadata
  purpose?: string;
  entityLabel?: string;
  descriptors?: string[];
  occurredAt?: string;
  revision?: number;
  customTitle?: string;

  // Source metadata (for external ingestion)
  source?: FileSourceMetadata;

  // Ingestion state (for quarantine pipeline)
  ingestion?: IngestionState;
}

/**
 * 🏢 ENTERPRISE: Result from buildPendingFileRecordData
 */
export interface BuildPendingFileRecordResult {
  /** Generated file ID */
  fileId: string;
  /** Generated storage path */
  storagePath: string;
  /** Display name generation result */
  displayNameResult: FileDisplayNameResult;
  /** Base FileRecord fields (add timestamps in adapter) */
  recordBase: FileRecordBase;
}

/**
 * 🏢 ENTERPRISE: Input for building finalize update
 */
export interface BuildFinalizeUpdateInput {
  /** File size in bytes */
  sizeBytes: number;
  /** Download URL from Storage */
  downloadUrl: string;
  /** Content hash (optional) */
  hash?: string;
  /**
   * Next status after finalize
   * - READY: Normal uploads (default)
   * - PENDING: Ingestion files (quarantine gate)
   */
  nextStatus?: FileStatus;
}

/**
 * 🏢 ENTERPRISE: Finalize update data (add timestamp in adapter)
 */
export interface FinalizeUpdateData {
  status: FileStatus;
  sizeBytes: number;
  downloadUrl: string;
  hash?: string;
}

// ============================================================================
// CORE FUNCTIONS - PURE, NO SDK DEPENDENCIES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Build pending FileRecord data
 *
 * Creates all deterministic FileRecord fields.
 * SDK adapters add timestamps and write to database.
 *
 * SINGLE SOURCE OF TRUTH for FileRecord schema construction.
 * Used by:
 * - FileRecordService (client SDK)
 * - Telegram webhook (admin SDK)
 * - Any future upload entry points
 *
 * @param input - Pure input (no SDK types)
 * @returns FileRecord base fields + metadata
 */
export function buildPendingFileRecordData(
  input: BuildPendingFileRecordInput
): BuildPendingFileRecordResult {
  // 1. Validate required fields
  if (!input.companyId) {
    throw new Error('companyId is REQUIRED for creating FileRecord');
  }
  if (!input.createdBy) {
    throw new Error('createdBy is REQUIRED for creating FileRecord');
  }

  // 2. Generate unique file ID
  const fileId = generateFileId();

  // 3. Get extension from originalFilename if not provided
  const ext = input.ext || getFileExtension(input.originalFilename);

  // 4. Build canonical storage path (IDs only, no names)
  const { path: storagePath } = buildStoragePath({
    companyId: input.companyId,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    fileId,
    ext,
  });

  // 5. Build display name (centralized naming)
  const displayNameResult = buildFileDisplayName({
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    entityLabel: input.entityLabel,
    purpose: input.purpose,
    descriptors: input.descriptors,
    occurredAt: input.occurredAt,
    revision: input.revision,
    ext,
    originalFilename: input.originalFilename,
    customTitle: input.customTitle,
    language: input.language || 'el',
  });

  // 6. Build base FileRecord (deterministic fields only)
  const recordBase: FileRecordBase = {
    id: fileId,
    companyId: input.companyId,
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    storagePath,
    displayName: displayNameResult.displayName,
    originalFilename: input.originalFilename,
    ext,
    contentType: input.contentType,
    status: FILE_STATUS.PENDING,
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    createdBy: input.createdBy,
  };

  // 7. Add optional fields only if defined (Firestore rejects undefined)
  if (input.projectId) {
    recordBase.projectId = input.projectId;
  }
  if (input.purpose) {
    recordBase.purpose = input.purpose;
  }
  if (input.entityLabel) {
    recordBase.entityLabel = input.entityLabel;
  }
  if (input.descriptors && input.descriptors.length > 0) {
    recordBase.descriptors = input.descriptors;
  }
  if (input.occurredAt) {
    recordBase.occurredAt = input.occurredAt.toISOString();
  }
  if (input.revision !== undefined) {
    recordBase.revision = input.revision;
  }
  if (input.customTitle) {
    recordBase.customTitle = input.customTitle;
  }
  if (input.source) {
    recordBase.source = input.source;
  }
  if (input.ingestion) {
    recordBase.ingestion = input.ingestion;
  }

  return {
    fileId,
    storagePath,
    displayNameResult,
    recordBase,
  };
}

/**
 * 🏢 ENTERPRISE: Build finalize update data
 *
 * Creates the update object for finalizing a FileRecord.
 * SDK adapters add timestamp and execute update.
 *
 * QUARANTINE GATE: Use nextStatus=PENDING for ingestion files
 * to keep them in quarantine until classification.
 *
 * @param input - Finalize parameters
 * @returns Update data (add timestamp in adapter)
 */
export function buildFinalizeFileRecordUpdate(
  input: BuildFinalizeUpdateInput
): FinalizeUpdateData {
  const updateData: FinalizeUpdateData = {
    status: input.nextStatus ?? FILE_STATUS.READY,
    sizeBytes: input.sizeBytes,
    downloadUrl: input.downloadUrl,
  };

  // Only include hash if provided
  if (input.hash !== undefined) {
    updateData.hash = input.hash;
  }

  return updateData;
}

/**
 * 🏢 ENTERPRISE: Build ingestion-specific storage path
 *
 * For files from external sources (Telegram, Email) that go through
 * the quarantine pipeline before being assigned to real entities.
 *
 * Path format:
 * companies/{companyId}/entities/company/{companyId}/domains/ingestion/categories/{category}/files/{fileId}.{ext}
 *
 * @param params - Path parameters
 * @returns Storage path string
 */
export function buildIngestionStoragePath(params: {
  companyId: string;
  category: FileCategory;
  fileId: string;
  ext: string;
}): string {
  const { companyId, category, fileId, ext } = params;
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;

  return [
    'companies',
    companyId,
    'entities',
    'company', // entityType = company for ingestion files
    companyId, // entityId = companyId
    'domains',
    'ingestion',
    'categories',
    category,
    'files',
    `${fileId}.${cleanExt}`,
  ].join('/');
}

/**
 * 🏢 ENTERPRISE: Build ingestion FileRecord data
 *
 * Specialized version for external sources (Telegram, Email).
 * Uses INGESTION domain and includes source metadata.
 *
 * QUARANTINE GATE: Status is PENDING until classification.
 *
 * @param input - Ingestion-specific input
 * @returns FileRecord base for ingestion files
 */
export function buildIngestionFileRecordData(input: {
  companyId: string;
  category: FileCategory;
  filename: string;
  contentType: string;
  ext: string;
  source: FileSourceMetadata;
}): BuildPendingFileRecordResult {
  // Generate file ID
  const fileId = generateFileId();

  // Build ingestion-specific storage path
  const storagePath = buildIngestionStoragePath({
    companyId: input.companyId,
    category: input.category,
    fileId,
    ext: input.ext,
  });

  // Build display name for ingestion files
  // Format: "Telegram - {senderName} - {filename}"
  const senderLabel = input.source.senderName || 'Unknown';
  const sourceLabel = input.source.type === 'telegram' ? 'Telegram' : input.source.type;
  const displayName = `${sourceLabel} - ${senderLabel} - ${input.filename}`;

  // Build ingestion state
  const ingestion: IngestionState = {
    state: 'received',
    stateChangedAt: new Date().toISOString(),
  };

  // Build base record
  const recordBase: FileRecordBase = {
    id: fileId,
    companyId: input.companyId,
    entityType: 'company' as EntityType, // Ingestion files belong to company
    entityId: input.companyId, // entityId = companyId
    domain: 'ingestion' as FileDomain,
    category: input.category,
    storagePath,
    displayName,
    originalFilename: input.filename,
    ext: input.ext,
    contentType: input.contentType,
    status: FILE_STATUS.PENDING, // QUARANTINE: Stays PENDING until classified
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    createdBy: 'system:ingestion',
    source: input.source,
    ingestion,
    entityLabel: `${sourceLabel} Chat ${input.source.chatId || 'unknown'}`,
  };

  // Return displayName result in expected format
  // For ingestion files, we create a simple result (not from buildFileDisplayName)
  const displayNameResult: FileDisplayNameResult = {
    displayName,
    normalizedTitle: displayName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    exportFilename: input.filename,
  };

  return {
    fileId,
    storagePath,
    displayNameResult,
    recordBase,
  };
}

// ============================================================================
// EXPORTS - BARREL
// ============================================================================

export {
  // Re-export utilities for convenience (direct import for server compatibility)
  generateFileId,
  getFileExtension,
} from '@/services/upload/utils/storage-path';
