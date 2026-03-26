/**
 * =============================================================================
 * useFloorplanAutoProcess — Auto-process unprocessed floorplan files (ADR-240)
 * =============================================================================
 *
 * Side-effect hook that detects FileRecords with status='ready' but no
 * processedData and triggers the /api/floorplans/process endpoint.
 * Uses a ref-guard to prevent re-submission on re-renders.
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFloorplanAutoProcess
 */

import { useEffect, useRef } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { auth } from '@/lib/firebase';
import { API_ROUTES } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

interface UseFloorplanAutoProcessParams {
  displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
  files: FileRecord[];
  refetch: () => Promise<void> | void;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FLOORPLAN_AUTO_PROCESS');

// ============================================================================
// HOOK
// ============================================================================

export function useFloorplanAutoProcess({
  displayStyle,
  files,
  refetch,
}: UseFloorplanAutoProcessParams): void {
  const submittedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (displayStyle !== 'floorplan-gallery') return;

    const unprocessed = files.filter(
      (f) =>
        !f.processedData &&
        f.downloadUrl &&
        f.status === 'ready' &&
        !submittedIds.current.has(f.id),
    );

    if (unprocessed.length === 0) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Mark as submitted immediately — prevents duplicate API calls on re-renders
    unprocessed.forEach((f) => submittedIds.current.add(f.id));

    let cancelled = false;

    const processFiles = async () => {
      let idToken: string;
      try {
        idToken = await currentUser.getIdToken();
      } catch {
        // Allow retry on next render
        unprocessed.forEach((f) => submittedIds.current.delete(f.id));
        return;
      }

      let anyProcessed = false;

      for (const file of unprocessed) {
        if (cancelled) return;
        try {
          const response = await fetch(API_ROUTES.FLOORPLANS.PROCESS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fileId: file.id, forceReprocess: false }),
          });
          if (response.ok) {
            anyProcessed = true;
            logger.info('Auto-processed floorplan', { fileId: file.id });
          } else {
            // HTTP error — allow retry on next mount
            submittedIds.current.delete(file.id);
            logger.warn('Auto-process returned HTTP error (non-blocking)', {
              fileId: file.id,
              status: response.status,
            });
          }
        } catch (err) {
          // Network error — allow retry on next render
          submittedIds.current.delete(file.id);
          logger.warn('Auto-process failed (non-blocking)', {
            fileId: file.id,
            error: String(err),
          });
        }
      }

      // After API writes processedData to Firestore, refetch to get the updated record
      if (anyProcessed && !cancelled) {
        await refetch();
      }
    };

    processFiles();

    return () => {
      cancelled = true;
    };
  }, [displayStyle, files, refetch]);
}
