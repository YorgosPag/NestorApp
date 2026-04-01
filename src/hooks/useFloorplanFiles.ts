/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Files Hook
 * =============================================================================
 *
 * Real-time hook for loading floorplan files from FileRecords.
 * Uses the centralized file storage system (not legacy FloorplanService).
 *
 * @module hooks/useFloorplanFiles
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Features:
 * - Real-time Firestore listener for instant updates
 * - Automatic processing of unprocessed files
 * - Filters by floorplan purpose (project, parking, etc.)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { where, orderBy } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FILE_CATEGORIES, FILE_DOMAINS, FILE_LIFECYCLE_STATES, API_ROUTES } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFloorplanFilesConfig {
  /** Company ID */
  companyId: string | undefined;
  /** Entity type (usually 'project') */
  entityType: 'project' | 'building' | 'property';
  /** Entity ID */
  entityId: string | undefined;
  /** Filter by purpose (e.g., 'project-floorplan', 'parking-floorplan') */
  purposeFilter?: string;
  /** Whether to auto-process unprocessed files */
  autoProcess?: boolean;
}

export interface UseFloorplanFilesReturn {
  /** All floorplan files */
  files: FileRecord[];
  /** Primary floorplan (first one or by purpose) */
  primaryFile: FileRecord | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Manually trigger refetch */
  refetch: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const logger = createModuleLogger('useFloorplanFiles');

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floorplan Files Hook
 *
 * Loads floorplan FileRecords with real-time updates.
 *
 * @example
 * ```tsx
 * const { primaryFile, files, loading } = useFloorplanFiles({
 *   companyId: 'company-123',
 *   entityType: 'project',
 *   entityId: 'project-456',
 *   purposeFilter: 'project-floorplan',
 * });
 *
 * if (primaryFile?.processedData?.scene) {
 *   // Render DXF scene
 * }
 * ```
 */
export function useFloorplanFiles(config: UseFloorplanFilesConfig): UseFloorplanFilesReturn {
  const {
    companyId,
    entityType,
    entityId,
    purposeFilter,
    autoProcess = true,
  } = config;

  const { user, loading: authLoading } = useAuth();

  // State
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /**
   * Manual refetch trigger
   */
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  /**
   * 🏢 ENTERPRISE: Auto-process unprocessed files via server-side API
   *
   * Calls /api/floorplans/process which bypasses CORS by processing server-side.
   * This solves the "Failed to fetch" CORS error when downloading from Firebase Storage.
   */
  const processUnprocessedFiles = useCallback(async (fileRecords: FileRecord[]) => {
    if (!autoProcess || !user) return;

    const unprocessed = fileRecords.filter(
      f => !f.processedData && f.downloadUrl && f.status === 'ready'
    );

    if (unprocessed.length === 0) return;

    logger.info(`Processing ${unprocessed.length} unprocessed files via API`);

    // 🏢 ENTERPRISE: Get ID token for API authentication
    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch (tokenError) {
      logger.error('Failed to get ID token', { error: tokenError });
      return;
    }

    for (const file of unprocessed) {
      try {
        // 🏢 ENTERPRISE: Call server-side API (bypasses CORS)
        // Authorization header required by withAuth middleware
        const response = await fetch(API_ROUTES.FLOORPLANS.PROCESS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fileId: file.id,
            forceReprocess: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        logger.info(`Processed via API: ${file.displayName}`, { result });
      } catch (err) {
        logger.warn(`Failed to process: ${file.displayName}`, { error: err });
      }
    }
  }, [autoProcess, user]);

  // =========================================================================
  // FIRESTORE LISTENER
  // =========================================================================

  useEffect(() => {
    // Wait for auth
    if (authLoading) return;

    // Validate params
    if (!user || !companyId || !entityId) {
      setLoading(false);
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    logger.info('Setting up listener', { companyId, entityType, entityId, purposeFilter });

    // 🏢 ENTERPRISE: Canonical pattern via firestoreQueryService.subscribe (ADR-227 Phase 2)
    // companyId auto-injected by firestoreQueryService — no manual where('companyId') needed
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'FILES',
      (result: QueryResult<DocumentData>) => {
        try {
          const fileRecords = result.documents.map(doc => ({
            ...doc,
          } as unknown as FileRecord));

          logger.info(`Received ${fileRecords.length} files`);

          // Filter by purpose if specified
          let filteredFiles = fileRecords;
          if (purposeFilter) {
            filteredFiles = fileRecords.filter(f => {
              const entryPoint = f.entryPointId || '';
              const fileData = f as unknown as { purpose?: string };
              const purpose = fileData.purpose || '';
              return entryPoint.includes(purposeFilter) || purpose.includes(purposeFilter);
            });
          }

          setFiles(filteredFiles);
          setLoading(false);

          // Auto-process unprocessed files in background
          processUnprocessedFiles(filteredFiles);

        } catch (err) {
          const errorMessage = getErrorMessage(err, 'Failed to load files');
          logger.error('Error processing snapshot', { error: errorMessage });
          setError(errorMessage);
          setLoading(false);
        }
      },
      (err: Error) => {
        logger.error('Listener error', { error: err });
        setError(err.message);
        setLoading(false);
      },
      {
        constraints: [
          where('entityType', '==', entityType),
          where('entityId', '==', entityId),
          where('domain', '==', FILE_DOMAINS.CONSTRUCTION),
          where('category', '==', FILE_CATEGORIES.FLOORPLANS),
          where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
          orderBy('createdAt', 'desc'),
        ],
      }
    );

    return () => {
      logger.info('Unsubscribing');
      unsubscribe();
    };
  }, [companyId, entityType, entityId, purposeFilter, user, authLoading, refreshTrigger, processUnprocessedFiles]);

  // =========================================================================
  // COMPUTED
  // =========================================================================

  // Primary file is the most recent one
  const primaryFile = files.length > 0 ? files[0] : null;

  return {
    files,
    primaryFile,
    loading,
    error,
    refetch,
  };
}

export default useFloorplanFiles;
