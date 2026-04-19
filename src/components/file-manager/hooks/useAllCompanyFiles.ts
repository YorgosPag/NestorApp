/**
 * =============================================================================
 * 🏢 ENTERPRISE: useAllCompanyFiles Hook (Real-time onSnapshot)
 * =============================================================================
 *
 * Centralized hook με REAL-TIME subscription για ΟΛΑ τα αρχεία εταιρείας.
 * Χρησιμοποιείται στο Central File Manager (/files).
 *
 * Uses Firestore onSnapshot for instant updates when files are uploaded
 * from ANY entry point (project tab, building tab, central file manager).
 *
 * Types and helper functions extracted to useAllCompanyFiles.helpers.ts (ADR-261)
 *
 * @module components/file-manager/hooks/useAllCompanyFiles
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```typescript
 * const { files, loading, error, refetch, filesByEntity, stats } = useAllCompanyFiles({
 *   companyId: 'company_123',
 *   includeDeleted: false
 * });
 * ```
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { FileRecordService } from '@/services/file-record.service';
import {
  moveFileToTrashWithPolicy,
  restoreFileFromTrashWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { isFileRecord } from '@/types/file-record';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { useAuth } from '@/auth/hooks/useAuth';
import { normalizeToISO } from '@/lib/date-local';
// 🏢 ENTERPRISE: Helpers extracted for SRP compliance (ADR-261)
import {
  groupFilesByEntity,
  groupFilesByCategory,
  calculateStats,
} from './useAllCompanyFiles.helpers';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache keyed by companyId — survives remount
const allCompanyFilesCache = createStaleCache<FileRecord[]>('files');
// Re-export types for backward compatibility
export type {
  FileEntityType,
  FileGroupCategory,
  FilesByEntity,
  FilesByCategory,
  FileStats,
} from './useAllCompanyFiles.helpers';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('USE_ALL_COMPANY_FILES');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hook parameters
 */
export interface UseAllCompanyFilesParams {
  /** Company ID for multi-tenant isolation (REQUIRED) */
  companyId: string;
  /** Include trashed files (default: false) */
  includeDeleted?: boolean;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

/**
 * Hook return value
 */
export interface UseAllCompanyFilesReturn {
  /** All files for the company */
  files: FileRecord[];
  /** Files in trash */
  trashedFiles: FileRecord[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch files from Firestore */
  refetch: () => Promise<void>;
  /** Files grouped by entity type and ID */
  filesByEntity: import('./useAllCompanyFiles.helpers').FilesByEntity;
  /** Files grouped by category */
  filesByCategory: import('./useAllCompanyFiles.helpers').FilesByCategory;
  /** File statistics */
  stats: import('./useAllCompanyFiles.helpers').FileStats;
  /** Move file to trash */
  moveToTrash: (fileId: string, trashedBy: string) => Promise<void>;
  /** Restore file from trash */
  restoreFromTrash: (fileId: string, restoredBy: string) => Promise<void>;
}

// ============================================================================
// HELPER FUNCTIONS (local)
// ============================================================================

// ADR-218: toISOStringOrPassthrough replaced by centralized normalizeToISO
const toISOStringOrPassthrough = (value: unknown): string | undefined =>
  normalizeToISO(value) ?? (value as string | undefined);

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Hook με REAL-TIME onSnapshot subscription
 *
 * Features:
 * - Real-time Firestore onSnapshot (instant updates from ANY entry point)
 * - Manual refetch for trashed files
 * - Files grouped by entity
 * - Files grouped by category
 * - Statistics calculation
 * - Trash operations (optimistic local + Firestore)
 * - Error handling
 * - Loading states
 * - Automatic cleanup on unmount
 */
export function useAllCompanyFiles(params: UseAllCompanyFilesParams): UseAllCompanyFilesReturn {
  const { user } = useAuth();
  const {
    companyId,
    autoFetch = true,
  } = params;

  // ADR-300: Seed from module-level cache keyed by companyId → zero flash on re-navigation
  const [files, setFiles] = useState<FileRecord[]>(allCompanyFilesCache.get(companyId) ?? []);
  const [trashedFiles, setTrashedFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(!allCompanyFilesCache.hasLoaded(companyId));
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // =========================================================================
  // REAL-TIME SUBSCRIPTION (onSnapshot)
  // =========================================================================

  useEffect(() => {
    if (!autoFetch || !companyId || !user) {
      setLoading(false);
      return;
    }

    logger.info('Setting up real-time subscription', { companyId });

    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!allCompanyFilesCache.hasLoaded(companyId)) setLoading(true);

    // 🏢 ADR-214 (C.5.34): subscribe via firestoreQueryService SSoT.
    // companyId auto-injected via buildTenantConstraints.
    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'FILES',
      (result) => {
        const activeFiles: FileRecord[] = [];

        for (const data of result.documents) {
          const record = {
            ...data,
            createdAt: toISOStringOrPassthrough(data.createdAt),
            updatedAt: toISOStringOrPassthrough(data.updatedAt),
          };

          if (isFileRecord(record)) {
            activeFiles.push(record);
          } else {
            logger.warn('Skipping invalid FileRecord in subscription', {
              docId: data.id,
              fields: {
                id: typeof record.id,
                entityType: typeof data.entityType,
                entityId: typeof data.entityId,
                domain: typeof data.domain,
                category: typeof data.category,
                storagePath: typeof data.storagePath,
                displayName: typeof data.displayName,
                originalFilename: typeof data.originalFilename,
                ext: typeof data.ext,
                contentType: typeof data.contentType,
                status: typeof data.status,
                createdBy: typeof data.createdBy,
              },
            });
          }
        }

        logger.info('Real-time update received', {
          activeCount: activeFiles.length,
          companyId,
        });

        // ADR-300: Write to module-level cache so next remount skips spinner
        allCompanyFilesCache.set(activeFiles, companyId);
        setFiles(activeFiles);
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error('Real-time subscription error', {
          error: err.message,
          companyId,
        });
        setError(err);
        setLoading(false);
      },
      {
        constraints: [
          where('status', '==', FILE_STATUS.READY),
          where('isDeleted', '==', false),
          where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
        ],
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount or companyId change
    return () => {
      logger.info('Cleaning up real-time subscription', { companyId });
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [autoFetch, companyId, user]);

  // =========================================================================
  // TRASHED FILES (one-time fetch + manual refetch)
  // =========================================================================

  const fetchTrashedFiles = useCallback(async () => {
    if (!companyId || !user) return;

    try {
      const trashed = await FileRecordService.getTrashedFiles({ companyId });
      setTrashedFiles(trashed);
    } catch (err) {
      logger.error('Failed to fetch trashed files', {
        error: err instanceof Error ? err.message : 'Unknown',
        companyId,
      });
    }
  }, [companyId, user]);

  // Fetch trashed files on mount
  useEffect(() => {
    if (autoFetch && companyId && user) {
      fetchTrashedFiles();
    }
  }, [autoFetch, companyId, user, fetchTrashedFiles]);

  // =========================================================================
  // REFETCH (for manual refresh — re-fetches trashed only, active is real-time)
  // =========================================================================

  const refetch = useCallback(async () => {
    await fetchTrashedFiles();
  }, [fetchTrashedFiles]);

  // =========================================================================
  // TRASH OPERATIONS
  // =========================================================================

  const moveToTrash = useCallback(async (fileId: string, trashedBy: string) => {
    try {
      logger.info('Moving file to trash', { fileId, trashedBy });

      await moveFileToTrashWithPolicy(fileId, trashedBy);

      // Optimistic: move from active to trashed in local state
      // Note: onSnapshot will also update `files` automatically
      setFiles(prev => {
        const file = prev.find(f => f.id === fileId);
        if (file) {
          setTrashedFiles(trashed => [...trashed, { ...file, isDeleted: true }]);
        }
        return prev.filter(f => f.id !== fileId);
      });

      logger.info('File moved to trash successfully', { fileId });
    } catch (err) {
      const trashError = err instanceof Error ? err : new Error('Unknown error moving file to trash');
      logger.error('Failed to move file to trash', {
        error: trashError.message,
        fileId,
      });
      throw trashError;
    }
  }, []);

  const restoreFromTrash = useCallback(async (fileId: string, restoredBy: string) => {
    try {
      logger.info('Restoring file from trash', { fileId, restoredBy });

      await restoreFileFromTrashWithPolicy(fileId, restoredBy);

      // Optimistic: move from trashed to active in local state
      // Note: onSnapshot will also update `files` automatically
      setTrashedFiles(prev => {
        const file = prev.find(f => f.id === fileId);
        if (file) {
          setFiles(active => [...active, { ...file, isDeleted: false }]);
        }
        return prev.filter(f => f.id !== fileId);
      });

      logger.info('File restored from trash successfully', { fileId });
    } catch (err) {
      const restoreError = err instanceof Error ? err : new Error('Unknown error restoring file');
      logger.error('Failed to restore file from trash', {
        error: restoreError.message,
        fileId,
      });
      throw restoreError;
    }
  }, []);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  const filesByEntity = useMemo(() => groupFilesByEntity(files), [files]);
  const filesByCategory = useMemo(() => groupFilesByCategory(files), [files]);
  const stats = useMemo(() => calculateStats(files), [files]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    files,
    trashedFiles,
    loading,
    error,
    refetch,
    filesByEntity,
    filesByCategory,
    stats,
    moveToTrash,
    restoreFromTrash,
  };
}
