/**
 * =============================================================================
 * 🏢 ENTERPRISE: FILE RECORD MODULE - BARREL EXPORTS
 * =============================================================================
 *
 * @module services/file-record
 * @enterprise ADR-031 - Canonical File Storage System
 */

// Core functions (pure, no SDK dependencies)
export {
  buildPendingFileRecordData,
  buildFinalizeFileRecordUpdate,
  buildIngestionStoragePath,
  buildIngestionFileRecordData,
  generateFileId,
  getFileExtension,
} from './file-record-core';

// Core types
export type {
  FileSourceMetadata,
  IngestionState,
  BuildPendingFileRecordInput,
  FileRecordBase,
  BuildPendingFileRecordResult,
  BuildFinalizeUpdateInput,
  FinalizeUpdateData,
} from './file-record-core';
