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
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { FileRecord } from '@/types/file-record';
import { FILE_CATEGORIES, FILE_DOMAINS, FILE_LIFECYCLE_STATES } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFloorplanFilesConfig {
  /** Company ID */
  companyId: string | undefined;
  /** Entity type (usually 'project') */
  entityType: 'project' | 'building' | 'unit';
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

const FILES_COLLECTION = 'files';

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

    console.log(`🏭 [useFloorplanFiles] Processing ${unprocessed.length} unprocessed files via API...`);

    // 🏢 ENTERPRISE: Get ID token for API authentication
    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch (tokenError) {
      console.error('❌ [useFloorplanFiles] Failed to get ID token:', tokenError);
      return;
    }

    for (const file of unprocessed) {
      try {
        // 🏢 ENTERPRISE: Call server-side API (bypasses CORS)
        // Authorization header required by withAuth middleware
        const response = await fetch('/api/floorplans/process', {
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
        console.log(`✅ [useFloorplanFiles] Processed via API: ${file.displayName}`, result);
      } catch (err) {
        console.warn(`⚠️ [useFloorplanFiles] Failed to process: ${file.displayName}`, err);
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

    console.log('🔔 [useFloorplanFiles] Setting up listener:', {
      companyId,
      entityType,
      entityId,
      purposeFilter,
    });

    // Build query for floorplan files
    const filesRef = collection(db, FILES_COLLECTION);
    const constraints = [
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      where('domain', '==', FILE_DOMAINS.CONSTRUCTION),
      where('category', '==', FILE_CATEGORIES.FLOORPLANS),
      where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
      orderBy('createdAt', 'desc'),
    ];

    const q = query(filesRef, ...constraints);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const fileRecords: FileRecord[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            fileRecords.push({
              id: doc.id,
              ...data,
            } as FileRecord);
          });

          console.log(`📡 [useFloorplanFiles] Received ${fileRecords.length} files`);

          // Filter by purpose if specified
          let filteredFiles = fileRecords;
          if (purposeFilter) {
            filteredFiles = fileRecords.filter(f => {
              // Check entryPointId or purpose field
              const entryPoint = f.entryPointId || '';
              // Purpose may be stored in custom metadata
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
          const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
          console.error('❌ [useFloorplanFiles] Error processing snapshot:', errorMessage);
          setError(errorMessage);
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ [useFloorplanFiles] Listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔕 [useFloorplanFiles] Unsubscribing');
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
