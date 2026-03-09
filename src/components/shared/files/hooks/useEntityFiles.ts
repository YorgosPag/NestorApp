/**
 * =============================================================================
 * 🏢 ENTERPRISE: useEntityFiles Hook
 * =============================================================================
 *
 * Centralized hook για file management operations σε entities.
 * Uses FileRecordService (ADR-031 Canonical File Storage System).
 *
 * @module components/shared/files/hooks/useEntityFiles
 * @enterprise ADR-031 - Single authority για entity file operations
 *
 * @example
 * ```typescript
 * const { files, loading, error, uploadFile, deleteFile, renameFile } = useEntityFiles({
 *   entityType: 'contact',
 *   entityId: 'contact_123',
 *   domain: 'admin',
 *   category: 'photos'
 * });
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('USE_ENTITY_FILES');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hook parameters for entity file operations
 */
export interface UseEntityFilesParams {
  /** Entity type (contact, building, unit, etc.) */
  entityType: EntityType;
  /** Entity ID */
  entityId: string;
  /** Company ID for query authorization (required for Firestore Rules) */
  companyId?: string;
  /** Optional domain filter */
  domain?: FileDomain;
  /** Optional category filter */
  category?: FileCategory;
  /** Optional purpose filter (e.g., 'project-floorplan', 'parking-floorplan') */
  purpose?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

/**
 * 🔗 ENTERPRISE: FileRecord extended with link status
 * Indicates whether a file is linked (referenced) vs owned by the current entity
 */
export interface FileRecordWithLinkStatus extends FileRecord {
  /** true if this file is linked from another entity (not directly owned) */
  isLinkedFile?: boolean;
}

/**
 * Hook return value
 */
export interface UseEntityFilesReturn {
  /** Array of FileRecords (may include linked files with isLinkedFile flag) */
  files: FileRecordWithLinkStatus[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch files from Firestore */
  refetch: () => Promise<void>;
  /** Move file to trash (soft delete with 30-day retention) */
  moveToTrash: (fileId: string, trashedBy: string) => Promise<void>;
  /** Rename file display name */
  renameFile: (fileId: string, newDisplayName: string, renamedBy: string) => Promise<void>;
  /** Update file description */
  updateDescription: (fileId: string, description: string) => Promise<void>;
  /** @deprecated Use moveToTrash instead */
  deleteFile: (fileId: string, deletedBy: string) => Promise<void>;
  /** Total storage used by entity (bytes) */
  totalStorageBytes: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Hook για entity file management
 *
 * Provides centralized file operations using FileRecordService.
 * All file data comes from Firestore FileRecord documents (Source of Truth).
 *
 * Features:
 * - Auto-fetch on mount
 * - Manual refetch
 * - Delete operations (soft delete)
 * - Storage usage tracking
 * - Error handling
 * - Loading states
 */
export function useEntityFiles(params: UseEntityFilesParams): UseEntityFilesReturn {
  const {
    entityType,
    entityId,
    companyId,
    domain,
    category,
    purpose,
    autoFetch = true,
  } = params;

  // State
  const [files, setFiles] = useState<FileRecordWithLinkStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // =========================================================================
  // FETCH FILES
  // =========================================================================

  /**
   * Fetch files from Firestore using FileRecordService
   * 🔗 ENTERPRISE: Dual-query — owned files + linked files (merged + deduplicated)
   */
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching files for entity', {
        entityType,
        entityId,
        domain,
        category,
        purpose,
      });

      // 🔗 ENTERPRISE: Parallel queries for owned + linked files
      const [fetchedFiles, linkedFiles] = await Promise.all([
        // Query 1: Files directly owned by this entity
        FileRecordService.getFilesByEntity(
          entityType,
          entityId,
          {
            companyId,
            domain,
            category,
            includeDeleted: false,
          }
        ),
        // Query 2: Files linked to this entity from other entities
        companyId
          ? FileRecordService.getLinkedFiles(entityType, entityId, companyId)
          : Promise.resolve([]),
      ]);

      // 🏢 ENTERPRISE: Client-side purpose filtering (backward compatible)
      const filterByPurpose = (file: FileRecord): boolean => {
        if (!purpose) return true;
        if (!file.purpose) return true;
        if (file.purpose === purpose) return true;
        if (file.purpose === 'floorplan' && purpose === 'project-floorplan') return true;
        return false;
      };

      const filteredOwned = fetchedFiles.filter(filterByPurpose);

      // 🔗 ENTERPRISE: Mark linked files and merge with owned files
      const ownedIds = new Set(filteredOwned.map(f => f.id));
      const uniqueLinked: FileRecordWithLinkStatus[] = linkedFiles
        .filter(f => !ownedIds.has(f.id)) // Deduplicate
        .filter(filterByPurpose)
        .map(f => ({ ...f, isLinkedFile: true }));

      const mergedFiles: FileRecordWithLinkStatus[] = [
        ...filteredOwned,
        ...uniqueLinked,
      ];

      logger.info('Files fetched successfully', {
        count: mergedFiles.length,
        owned: filteredOwned.length,
        linked: uniqueLinked.length,
        entityType,
        entityId,
        purposeFilter: purpose || 'none',
      });

      setFiles(mergedFiles);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error fetching files');
      logger.error('Failed to fetch files', {
        error: error.message,
        entityType,
        entityId,
      });
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, companyId, domain, category, purpose]);

  // =========================================================================
  // 🗑️ TRASH OPERATIONS (Enterprise Trash System - ADR-032)
  // =========================================================================

  /**
   * 🗑️ Move file to Trash (soft delete with retention policy)
   * @enterprise ADR-032 - Enterprise Trash System
   *
   * File remains in Firestore/Storage for 30 days (configurable by category).
   * User can restore from Trash view. Server-side scheduler handles purge.
   */
  const moveToTrash = useCallback(async (fileId: string, trashedBy: string) => {
    try {
      logger.info('Moving file to trash', { fileId, trashedBy });

      await FileRecordService.moveToTrash(fileId, trashedBy);

      logger.info('File moved to trash successfully', { fileId });

      // Remove from local state (file is now in "trashed" state)
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error moving file to trash');
      logger.error('Failed to move file to trash', {
        error: error.message,
        fileId,
      });
      throw error; // Re-throw for UI error handling
    }
  }, []);

  // =========================================================================
  // RENAME OPERATIONS
  // =========================================================================

  /**
   * Rename file display name
   * Updates displayName in Firestore and local state instantly
   */
  const renameFile = useCallback(async (fileId: string, newDisplayName: string, renamedBy: string) => {
    try {
      logger.info('Renaming file', { fileId, newDisplayName, renamedBy });

      await FileRecordService.renameFile(fileId, newDisplayName, renamedBy);

      logger.info('File renamed successfully', { fileId });

      // Update local state immediately (optimistic update)
      setFiles((prev) => prev.map((file) =>
        file.id === fileId
          ? { ...file, displayName: newDisplayName.trim() }
          : file
      ));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error renaming file');
      logger.error('Failed to rename file', {
        error: error.message,
        fileId,
      });
      throw error;
    }
  }, []);

  // =========================================================================
  // DESCRIPTION OPERATIONS
  // =========================================================================

  const updateDescription = useCallback(async (fileId: string, description: string) => {
    try {
      logger.info('Updating file description', { fileId });

      await FileRecordService.updateDescription(fileId, description);

      // Optimistic local state update
      setFiles((prev) => prev.map((file) =>
        file.id === fileId
          ? { ...file, description: description.trim() || undefined }
          : file
      ));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error updating description');
      logger.error('Failed to update description', { error: error.message, fileId });
      throw error;
    }
  }, []);

  /**
   * @deprecated Use moveToTrash instead
   * Kept for backward compatibility
   */
  const deleteFile = useCallback(async (fileId: string, deletedBy: string) => {
    logger.warn('deleteFile is deprecated, use moveToTrash instead', { fileId });
    return moveToTrash(fileId, deletedBy);
  }, [moveToTrash]);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  /**
   * Calculate total storage used by files
   */
  const totalStorageBytes = files.reduce(
    (total, file) => total + (file.sizeBytes || 0),
    0
  );

  // =========================================================================
  // EFFECTS
  // =========================================================================

  /**
   * Auto-fetch files on mount or when params change
   */
  useEffect(() => {
    if (autoFetch && entityId) {
      fetchFiles();
    }
  }, [autoFetch, entityId, fetchFiles]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    files,
    loading,
    error,
    refetch: fetchFiles,
    moveToTrash,
    renameFile,
    updateDescription,
    deleteFile, // @deprecated - use moveToTrash
    totalStorageBytes,
  };
}
