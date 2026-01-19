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
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

/**
 * Hook return value
 */
export interface UseEntityFilesReturn {
  /** Array of FileRecords */
  files: FileRecord[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch files from Firestore */
  refetch: () => Promise<void>;
  /** Delete a file (soft delete) */
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
    autoFetch = true,
  } = params;

  // State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // =========================================================================
  // FETCH FILES
  // =========================================================================

  /**
   * Fetch files from Firestore using FileRecordService
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
      });

      // Use FileRecordService to fetch files
      const fetchedFiles = await FileRecordService.getFilesByEntity(
        entityType,
        entityId,
        {
          companyId, // 🏢 ENTERPRISE: Required for Firestore Rules query authorization
          domain,
          category,
          includeDeleted: false, // Don't include soft-deleted files
        }
      );

      logger.info('Files fetched successfully', {
        count: fetchedFiles.length,
        entityType,
        entityId,
      });

      setFiles(fetchedFiles);
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
  }, [entityType, entityId, companyId, domain, category]);

  // =========================================================================
  // DELETE FILE
  // =========================================================================

  /**
   * Delete a file (soft delete - keeps FileRecord for audit trail)
   */
  const deleteFile = useCallback(async (fileId: string, deletedBy: string) => {
    try {
      logger.info('Deleting file', { fileId, deletedBy });

      await FileRecordService.softDeleteFileRecord(fileId, deletedBy);

      logger.info('File deleted successfully', { fileId });

      // Remove from local state
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error deleting file');
      logger.error('Failed to delete file', {
        error: error.message,
        fileId,
      });
      throw error; // Re-throw για UI error handling
    }
  }, []);

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
    deleteFile,
    totalStorageBytes,
  };
}
