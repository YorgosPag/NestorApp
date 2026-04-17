/**
 * useEntityFiles — Centralized hook for entity file management (ADR-031).
 * @module components/shared/files/hooks/useEntityFiles
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { where } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { FileRecordService } from '@/services/file-record.service';
import {
  moveFileToTrashWithPolicy,
  renameFileWithPolicy,
  updateFileDescriptionWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { FileRecord } from '@/types/file-record';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import type { FileCreatedPayload, FileUpdatedPayload, FileTrashedPayload, FileRestoredPayload, FileLinkCreatedPayload } from '@/services/realtime';
import { buildPurposeFilter } from './useEntityFiles-purpose-filter';

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
  /** ADR-236 Phase 3: Filter unit floorplans by level floor ID */
  levelFloorId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /**
   * 🏢 ADR-240: Real-time Firestore listener mode.
   * When true, uses firestoreQueryService.subscribe (onSnapshot) instead of
   * one-time getAll. Server-side updates (e.g. processedData from /api/floorplans/process)
   * propagate to the UI automatically without any manual refetch.
   * Default: false (backward compatible — one-time fetch).
   */
  realtime?: boolean;
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
    levelFloorId,
    autoFetch = true,
    realtime = false,
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
        companyId,
        domain,
        category,
        purpose,
        levelFloorId,
      });

      // 🔗 ENTERPRISE: Parallel queries — linked files failure is non-blocking
      const [fetchedFiles, linkedFiles] = await Promise.all([
        FileRecordService.getFilesByEntity(entityType, entityId, {
          companyId, domain, category, levelFloorId, includeDeleted: false,
        }),
        companyId
          ? FileRecordService.getLinkedFiles(entityType, entityId, companyId)
              .catch((err: unknown) => {
                const code = (err as { code?: string })?.code ?? '';
                logger.warn('Linked files query failed (non-blocking)', { code, entityType, entityId });
                return [] as FileRecord[];
              })
          : Promise.resolve([] as FileRecord[]),
      ]);

      // 🏢 ENTERPRISE: Client-side purpose filtering (backward compatible)
      // Helper extracted to useEntityFiles-purpose-filter — see module docs
      // for META_PHOTO_PURPOSES and '*-floorplan' semantics (ADR-293 Phase 7).
      const filterByPurpose = buildPurposeFilter(purpose);

      const filteredOwned = fetchedFiles
        .filter(FileRecordService.isVisibleInActiveLists)
        .filter(filterByPurpose);

      // 🔗 ENTERPRISE: Mark linked files and merge with owned files
      const ownedIds = new Set(filteredOwned.map(f => f.id));
      const uniqueLinked: FileRecordWithLinkStatus[] = linkedFiles
        .filter(f => !ownedIds.has(f.id)) // Deduplicate
        .filter(FileRecordService.isVisibleInActiveLists)
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
      const errObj = err instanceof Error ? err : new Error(String(err));
      const code = (err as { code?: string })?.code ?? 'unknown';
      // Permission errors are expected (auth loading, unsaved entities) — don't show to user
      if (code === 'permission-denied' || errObj.message.includes('permissions')) {
        logger.warn('Files permission denied (expected during auth/creation)', { entityType, entityId });
        setFiles([]);
        setLoading(false);
        return;
      }
      logger.warn('Failed to fetch files', { code, message: errObj.message, entityType, entityId });
      setError(errObj);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, companyId, domain, category, purpose, levelFloorId]);

  // =========================================================================
  // 🏢 ADR-240: REAL-TIME LISTENER (Firestore onSnapshot)
  // Active only when realtime=true. Uses firestoreQueryService.subscribe —
  // same pattern as useFloorplanFiles. Server-side updates (e.g. processedData
  // written by /api/floorplans/process) propagate automatically to the UI.
  // =========================================================================

  // Stable ref for purpose filter — avoids subscription re-creation on every render
  const purposeRef = useRef(purpose);
  useEffect(() => { purposeRef.current = purpose; }, [purpose]);

  useEffect(() => {
    if (!realtime || !entityId || !companyId) return;

    setLoading(true);

    // Build same constraints as getFilesByEntity
    // 🔒 SECURITY: companyId constraint is REQUIRED for Firestore Security Rules
    // Without it, the query fails with PERMISSION_DENIED because rules enforce
    // belongsToCompany(resource.data.companyId) tenant isolation.
    const constraints = [
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      where('status', '==', FILE_STATUS.READY),
      where('isDeleted', '==', false),
      where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
      ...(domain ? [where('domain', '==', domain)] : []),
      ...(category ? [where('category', '==', category)] : []),
      ...(levelFloorId ? [where('levelFloorId', '==', levelFloorId)] : []),
    ];

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        const currentPurpose = purposeRef.current;

        const filterByPurpose = buildPurposeFilter(currentPurpose);

        const records = result.documents
          .map(doc => doc as unknown as FileRecord)
          .filter(filterByPurpose);

        setFiles(records);
        setLoading(false);
        setError(null);

        logger.info('[realtime] Files updated', {
          count: records.length,
          entityType,
          entityId,
        });
      },
      (err: unknown) => {
        const code = (err as { code?: string })?.code ?? 'unknown';
        // Permission errors are expected (auth loading, unsaved entities)
        if (code === 'permission-denied') {
          logger.warn('[realtime] Permission denied (expected)', { entityType, entityId });
          setFiles([]);
          setLoading(false);
          return;
        }
        logger.warn('[realtime] Listener failed, falling back to one-time fetch', { code, entityType, entityId });
        void fetchFiles().catch(() => { setLoading(false); });
      },
      { constraints },
    );

    return () => {
      unsubscribe();
    };
  }, [realtime, entityType, entityId, companyId, domain, category, levelFloorId]);

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

      await moveFileToTrashWithPolicy(fileId, trashedBy);

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

      await renameFileWithPolicy(fileId, newDisplayName, renamedBy);

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

      await updateFileDescriptionWithPolicy(fileId, description);

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
   * Auto-fetch files on mount or when params change.
   * Skip when realtime=true — the onSnapshot listener handles data delivery.
   * Running both causes race conditions where one overwrites the other.
   */
  useEffect(() => {
    if (autoFetch && entityId && !realtime) {
      fetchFiles();
    }
  }, [autoFetch, entityId, fetchFiles]);

  // =========================================================================
  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab file sync (ADR-228 Tier 2)
  // =========================================================================

  useEffect(() => {
    if (!entityId) return;

    const handleCreated = (payload: FileCreatedPayload) => {
      if (payload.file.entityId === entityId && payload.file.entityType === entityType) {
        logger.info('File created for current entity — refetching', { fileId: payload.fileId });
        fetchFiles();
      }
    };

    const handleUpdated = (payload: FileUpdatedPayload) => {
      setFiles(prev => prev.map(file => {
        if (file.id !== payload.fileId) return file;
        const { status, lifecycleState, ...safeUpdates } = payload.updates;
        return {
          ...file,
          ...safeUpdates,
          // Narrow string → typed enum — realtime payload uses string but FileRecord requires typed enums
          ...(status != null && { status: status as FileRecord['status'] }),
          ...(lifecycleState != null && { lifecycleState: lifecycleState as FileRecord['lifecycleState'] }),
        };
      }));
    };

    const handleTrashed = (payload: FileTrashedPayload) => {
      setFiles(prev => prev.filter(file => file.id !== payload.fileId));
    };

    const handleRestored = (payload: FileRestoredPayload) => {
      logger.info('File restored — refetching', { fileId: payload.fileId });
      fetchFiles();
    };

    const handleFileLinked = (payload: FileLinkCreatedPayload) => {
      if (payload.link.targetEntityType === entityType && payload.link.targetEntityId === entityId) {
        logger.info('File linked to current entity — refetching', { linkId: payload.linkId });
        fetchFiles();
      }
    };

    const unsub1 = RealtimeService.subscribe('FILE_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('FILE_UPDATED', handleUpdated);
    const unsub3 = RealtimeService.subscribe('FILE_TRASHED', handleTrashed);
    const unsub4 = RealtimeService.subscribe('FILE_RESTORED', handleRestored);
    const unsub5 = RealtimeService.subscribe('FILE_LINK_CREATED', handleFileLinked);

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [entityId, entityType, fetchFiles]);

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
