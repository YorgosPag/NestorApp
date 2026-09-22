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
import { isAutoProcessableFloorplan } from '@/services/floorplans/floorplan-processability';
// ADR-635 Φ3 — Revit-style import-warnings toast (SSoT).
import { useDxfImportNotifications } from '@/hooks/notifications/useDxfImportNotifications';

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

type ImportNotifications = ReturnType<typeof useDxfImportNotifications>;

/** Ένα αρχείο → `true` όταν ο διακομιστής **έγραψε** αποτέλεσμα (όχι «ήδη σε εξέλιξη»). */
async function processOne(
  fileId: string,
  submittedIds: Set<string>,
  notifications: ImportNotifications,
): Promise<boolean> {
  try {
    const result = await processFloorplanWithPolicy({ fileId, forceReprocess: false });
    if (isInProgress(result)) {
      // Server is already processing this file (another instance or concurrent request).
      // Keep submittedIds guard — Firestore realtime listener will deliver processedData when done.
      logger.info('Floorplan already processing (Firestore lock)', { fileId });
      return false;
    }
    logger.info('Auto-processed floorplan', { fileId });
    // ADR-635 Φ3 — surface partial-import warnings (skipped/failed/clamped entities).
    notifications.importedWithWarnings(result.warnings);
    return true;
  } catch (err) {
    // Allow retry on next render
    submittedIds.delete(fileId);
    logger.warn('Auto-process failed (non-blocking)', { fileId, error: String(err) });
    return false;
  }
}

export function useFloorplanAutoProcess({
  displayStyle,
  files,
  refetch,
}: UseFloorplanAutoProcessParams): void {
  const submittedIds = useRef<Set<string>>(new Set());
  const dxfImportNotifications = useDxfImportNotifications();

  useEffect(() => {
    if (displayStyle !== 'floorplan-gallery') return;

    // ADR-866 §2.10.9 — μόνο ό,τι ο διακομιστής **μπορεί** να επεξεργαστεί (είδος + διαμέρισμα).
    const pending = files
      .filter((f) => isAutoProcessableFloorplan(f) && !submittedIds.current.has(f.id))
      .map((f) => f.id);
    if (pending.length === 0) return;

    // Mark as submitted immediately — prevents duplicate API calls on re-renders
    pending.forEach((id) => submittedIds.current.add(id));
    let cancelled = false;

    const processFiles = async () => {
      let anyProcessed = false;
      for (const [index, fileId] of pending.entries()) {
        if (cancelled) {
          // ADR-866 §2.10.9 — ό,τι δεν δοκιμάστηκε **ελευθερώνεται**· αλλιώς δεν ξαναστέλνεται ποτέ.
          pending.slice(index).forEach((id) => submittedIds.current.delete(id));
          return;
        }
        if (await processOne(fileId, submittedIds.current, dxfImportNotifications)) anyProcessed = true;
      }
      // After API writes processedData to Firestore, refetch to get the updated record
      if (anyProcessed && !cancelled) await refetch();
    };

    processFiles();
    return () => {
      cancelled = true;
    };
  }, [displayStyle, files, refetch, dxfImportNotifications]);
}
