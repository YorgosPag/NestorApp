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
import type { FileRecord } from '@/types/file-record';
import {
  processFloorplanWithPolicy,
  isInProgress,
} from '@/services/floorplans/floorplan-processing-mutation-gateway';

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

    // Mark as submitted immediately — prevents duplicate API calls on re-renders
    unprocessed.forEach((f) => submittedIds.current.add(f.id));

    let cancelled = false;

    const processFiles = async () => {
      let anyProcessed = false;

      for (const file of unprocessed) {
        if (cancelled) return;

        try {
          const result = await processFloorplanWithPolicy({ fileId: file.id, forceReprocess: false });
          if (isInProgress(result)) {
            // Server is already processing this file (another instance or concurrent request).
            // Keep submittedIds guard — Firestore realtime listener will deliver processedData when done.
            logger.info('Floorplan already processing (Firestore lock)', { fileId: file.id });
          } else {
            anyProcessed = true;
            logger.info('Auto-processed floorplan', { fileId: file.id });
          }
        } catch (err) {
          // Allow retry on next render
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
