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
import {
  collection,
  query,
  where,
  onSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FileRecordService } from '@/services/file-record.service';
import { isFileRecord } from '@/types/file-record';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_STATUS } from '@/config/domain-constants';

/**
 * Supported entity types for file stats
 */
type FileEntityType = 'project' | 'building' | 'unit' | 'contact' | 'company';

/**
 * Common file categories for grouping
 */
type FileGroupCategory = 'photos' | 'videos' | 'documents' | 'contracts' | 'floorplans' | 'other';

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
 * Files grouped by entity type and ID
 */
export interface FilesByEntity {
  projects: Record<string, FileRecord[]>;
  buildings: Record<string, FileRecord[]>;
  units: Record<string, FileRecord[]>;
  contacts: Record<string, FileRecord[]>;
  companies: Record<string, FileRecord[]>;
}

/**
 * Files grouped by category
 */
export interface FilesByCategory {
  photos: FileRecord[];
  videos: FileRecord[];
  documents: FileRecord[];
  contracts: FileRecord[];
  floorplans: FileRecord[];
  other: FileRecord[];
}

/**
 * File statistics
 */
export interface FileStats {
  totalFiles: number;
  totalSizeBytes: number;
  byEntityType: Record<FileEntityType, number>;
  byCategory: Record<FileGroupCategory, number>;
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
  filesByEntity: FilesByEntity;
  /** Files grouped by category */
  filesByCategory: FilesByCategory;
  /** File statistics */
  stats: FileStats;
  /** Move file to trash */
  moveToTrash: (fileId: string, trashedBy: string) => Promise<void>;
  /** Restore file from trash */
  restoreFromTrash: (fileId: string, restoredBy: string) => Promise<void>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert Firestore Timestamp to ISO string, or passthrough string values
 */
function toISOStringOrPassthrough(value: unknown): string | undefined {
  if (value instanceof Object && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  return value as string | undefined;
}

/**
 * Group files by entity type and ID
 */
function groupFilesByEntity(files: FileRecord[]): FilesByEntity {
  const grouped: FilesByEntity = {
    projects: {},
    buildings: {},
    units: {},
    contacts: {},
    companies: {},
  };

  for (const file of files) {
    const entityType = file.entityType as string;
    const entityId = file.entityId;

    // Map entity types to our structure
    let targetGroup: Record<string, FileRecord[]> | undefined;
    switch (entityType) {
      case 'project':
        targetGroup = grouped.projects;
        break;
      case 'building':
        targetGroup = grouped.buildings;
        break;
      case 'unit':
        targetGroup = grouped.units;
        break;
      case 'contact':
        targetGroup = grouped.contacts;
        break;
      case 'company':
        targetGroup = grouped.companies;
        break;
      default:
        // Skip unknown entity types
        continue;
    }

    if (!targetGroup) continue;

    if (!targetGroup[entityId]) {
      targetGroup[entityId] = [];
    }
    targetGroup[entityId].push(file);
  }

  return grouped;
}

/**
 * Group files by category
 */
function groupFilesByCategory(files: FileRecord[]): FilesByCategory {
  const grouped: FilesByCategory = {
    photos: [],
    videos: [],
    documents: [],
    contracts: [],
    floorplans: [],
    other: [],
  };

  for (const file of files) {
    const category = file.category as string;

    switch (category) {
      case 'photos':
        grouped.photos.push(file);
        break;
      case 'videos':
        grouped.videos.push(file);
        break;
      case 'documents':
        grouped.documents.push(file);
        break;
      case 'contracts':
        grouped.contracts.push(file);
        break;
      case 'floorplans':
        grouped.floorplans.push(file);
        break;
      default:
        grouped.other.push(file);
    }
  }

  return grouped;
}

/**
 * Calculate file statistics
 */
function calculateStats(files: FileRecord[]): FileStats {
  const stats: FileStats = {
    totalFiles: files.length,
    totalSizeBytes: 0,
    byEntityType: {
      project: 0,
      building: 0,
      unit: 0,
      contact: 0,
      company: 0,
    },
    byCategory: {
      photos: 0,
      videos: 0,
      documents: 0,
      contracts: 0,
      floorplans: 0,
      other: 0,
    },
  };

  const supportedEntityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact', 'company'];
  const supportedCategories: FileGroupCategory[] = ['photos', 'videos', 'documents', 'contracts', 'floorplans'];

  for (const file of files) {
    stats.totalSizeBytes += file.sizeBytes || 0;

    // Count by entity type
    const entityType = file.entityType as string;
    if (supportedEntityTypes.includes(entityType as FileEntityType)) {
      stats.byEntityType[entityType as FileEntityType]++;
    }

    // Count by category
    const category = file.category as string;
    if (supportedCategories.includes(category as FileGroupCategory)) {
      stats.byCategory[category as FileGroupCategory]++;
    } else {
      stats.byCategory.other++;
    }
  }

  return stats;
}

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
  const {
    companyId,
    autoFetch = true,
  } = params;

  // State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // =========================================================================
  // REAL-TIME SUBSCRIPTION (onSnapshot)
  // =========================================================================

  useEffect(() => {
    if (!autoFetch || !companyId) {
      setLoading(false);
      return;
    }

    logger.info('Setting up real-time subscription', { companyId });

    // Build query: active files for this company
    const filesQuery = query(
      collection(db, COLLECTIONS.FILES),
      where('companyId', '==', companyId),
      where('status', '==', FILE_STATUS.READY),
      where('isDeleted', '==', false)
    );

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const activeFiles: FileRecord[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const record = {
            ...data,
            id: docSnap.id,
            createdAt: toISOStringOrPassthrough(data.createdAt),
            updatedAt: toISOStringOrPassthrough(data.updatedAt),
          };

          if (isFileRecord(record)) {
            activeFiles.push(record);
          } else {
            logger.warn('Skipping invalid FileRecord in onSnapshot', {
              docId: docSnap.id,
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
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount or companyId change
    return () => {
      logger.info('Cleaning up real-time subscription', { companyId });
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [autoFetch, companyId]);

  // =========================================================================
  // TRASHED FILES (one-time fetch + manual refetch)
  // =========================================================================

  const fetchTrashedFiles = useCallback(async () => {
    if (!companyId) return;

    try {
      const trashed = await FileRecordService.getTrashedFiles({ companyId });
      setTrashedFiles(trashed);
    } catch (err) {
      logger.error('Failed to fetch trashed files', {
        error: err instanceof Error ? err.message : 'Unknown',
        companyId,
      });
    }
  }, [companyId]);

  // Fetch trashed files on mount
  useEffect(() => {
    if (autoFetch && companyId) {
      fetchTrashedFiles();
    }
  }, [autoFetch, companyId, fetchTrashedFiles]);

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

      await FileRecordService.moveToTrash(fileId, trashedBy);

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

      await FileRecordService.restoreFromTrash(fileId, restoredBy);

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
