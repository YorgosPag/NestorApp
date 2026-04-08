/**
 * =============================================================================
 * 🏢 ENTERPRISE: FILE RECORD INGESTION - EXTRACTED FROM CORE (SRP)
 * =============================================================================
 *
 * Specialized functions for external ingestion sources (Telegram, Email).
 * Extracted from file-record-core.ts to comply with 500-line limit (ADR N.7.1).
 *
 * @module services/file-record/file-record-ingestion
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 */

import {
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
  SYSTEM_IDENTITY,
  ENTITY_TYPES,
} from '@/config/domain-constants';
import type { FileCategory, FileDomain } from '@/config/domain-constants';
import { generateFileId } from '@/services/upload/utils/storage-path';
import type { FileDisplayNameResult } from '@/services/upload/utils/file-display-name';
import type {
  FileSourceMetadata,
  IngestionState,
  FileRecordBase,
  BuildPendingFileRecordResult,
} from './file-record-core';

// ============================================================================
// INGESTION STORAGE PATH
// ============================================================================

/**
 * 🏢 ENTERPRISE: Build ingestion-specific storage path
 *
 * Format: companies/{companyId}/entities/company/{companyId}/domains/ingestion/categories/{category}/files/{fileId}.{ext}
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

// ============================================================================
// INGESTION FILE RECORD DATA
// ============================================================================

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
    entityType: ENTITY_TYPES.COMPANY, // Ingestion files belong to company
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
    createdBy: SYSTEM_IDENTITY.INGESTION_ID,
    source: input.source,
    ingestion,
    entityLabel: `${sourceLabel} Chat ${input.source.chatId || 'unknown'}`,
  };

  // Return displayName result in expected format
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
