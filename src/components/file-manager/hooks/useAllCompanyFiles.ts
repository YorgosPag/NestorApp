/**
 * =============================================================================
 * 🏢 ENTERPRISE: useAllCompanyFiles Hook
 * =============================================================================
 *
 * Centralized hook για fetch ΟΛΩΝ των αρχείων μιας εταιρείας.
 * Χρησιμοποιείται στο Central File Manager (/files).
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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileRecordService } from '@/services/file-record.service';
import type { FileRecord } from '@/types/file-record';
import type { FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_STATUS } from '@/config/domain-constants';

/**
 * Supported entity types for file stats
 */
type FileEntityType = 'project' | 'building' | 'unit' | 'contact';

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
 * Group files by entity type and ID
 */
function groupFilesByEntity(files: FileRecord[]): FilesByEntity {
  const grouped: FilesByEntity = {
    projects: {},
    buildings: {},
    units: {},
    contacts: {},
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

  const supportedEntityTypes: FileEntityType[] = ['project', 'building', 'unit', 'contact'];
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
 * 🏢 ENTERPRISE: Hook για fetch ΟΛΩΝ των αρχείων εταιρείας
 *
 * Features:
 * - Auto-fetch on mount
 * - Manual refetch
 * - Files grouped by entity
 * - Files grouped by category
 * - Statistics calculation
 * - Trash operations
 * - Error handling
 * - Loading states
 */
export function useAllCompanyFiles(params: UseAllCompanyFilesParams): UseAllCompanyFilesReturn {
  const {
    companyId,
    includeDeleted = false,
    autoFetch = true,
  } = params;

  // State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // =========================================================================
  // FETCH FILES
  // =========================================================================

  const fetchFiles = useCallback(async () => {
    if (!companyId) {
      logger.warn('Cannot fetch files: companyId is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching all company files', { companyId, includeDeleted });

      // Fetch active files
      const activeFiles = await FileRecordService.queryFileRecords({
        companyId,
        status: FILE_STATUS.READY,
        includeDeleted: false,
      });

      // Fetch trashed files separately
      const trashed = await FileRecordService.getTrashedFiles({
        companyId,
      });

      logger.info('Files fetched successfully', {
        activeCount: activeFiles.length,
        trashedCount: trashed.length,
        companyId,
      });

      setFiles(activeFiles);
      setTrashedFiles(trashed);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Unknown error fetching files');
      logger.error('Failed to fetch company files', {
        error: fetchError.message,
        companyId,
      });
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [companyId, includeDeleted]);

  // =========================================================================
  // TRASH OPERATIONS
  // =========================================================================

  const moveToTrash = useCallback(async (fileId: string, trashedBy: string) => {
    try {
      logger.info('Moving file to trash', { fileId, trashedBy });

      await FileRecordService.moveToTrash(fileId, trashedBy);

      // Update local state
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

      // Update local state
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
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    if (autoFetch && companyId) {
      fetchFiles();
    }
  }, [autoFetch, companyId, fetchFiles]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    files,
    trashedFiles,
    loading,
    error,
    refetch: fetchFiles,
    filesByEntity,
    filesByCategory,
    stats,
    moveToTrash,
    restoreFromTrash,
  };
}
