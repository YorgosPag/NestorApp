/**
 * useEntityFilesRealtime — ο ακροατής Firestore (onSnapshot) του `useEntityFiles` (ADR-240).
 *
 * Εξήχθη από το `useEntityFiles.ts` (N.7.1 — 492 γρ. πριν δεχτεί κάτοχο «εταιρεία Ή άνθρωπος»,
 * ADR-866 §2.6.8). Ενεργός **μόνο** με `enabled`. Server-side updates (e.g. processedData from
 * /api/floorplans/process) propagate to the UI automatically without any manual refetch.
 *
 * 🔑 Διαμέρισμα + φίλτρο κατόχου από το **ίδιο** σημείο με την εφάπαξ ανάγνωση
 * (`fileOwnerConstraints` / `fileReadKindOf`) — δύο χειρόγραφες συνθέσεις θα απέκλιναν.
 *
 * @module components/shared/files/hooks/useEntityFilesRealtime
 */

import { useEffect, useRef } from 'react';
import { where } from 'firebase/firestore';
import type { DocumentData, QueryConstraint } from 'firebase/firestore';

import type { EntityType, FileCategory, FileDomain } from '@/config/domain-constants';
import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import { FILE_COLLECTION, type FileCustody } from '@/lib/files/file-custody';
import { isPermissionDeniedError } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { FileRecordService, toFileRecord } from '@/services/file-record.service';
import { fileOwnerConstraints, fileReadKindOf } from '@/services/file-record-queries';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { FileRecord } from '@/types/file-record';
import { buildFileReadFilter, type FileScope } from '../utils/upload-scope';

const logger = createModuleLogger('USE_ENTITY_FILES');

interface UseEntityFilesRealtimeParams {
  readonly enabled: boolean;
  readonly entityType: EntityType;
  readonly entityId: string;
  /** Σταθερή ταυτότητα (`useStableFileCustody`) — αλλιώς ο ακροατής ξαναστήνεται σε κάθε render. */
  readonly custody: FileCustody | undefined;
  readonly domain?: FileDomain;
  readonly category?: FileCategory;
  readonly purpose?: string;
  /** ADR-866 §2.10 Β1 — interned (`internFileScopes`): ίδια ταυτότητα για ίδιο περιεχόμενο, ασφαλές σε deps. */
  readonly scopes?: readonly FileScope[];
  readonly levelFloorId?: string;
  readonly onFiles: (files: FileRecord[]) => void;
  readonly onLoading: (loading: boolean) => void;
  readonly onError: (error: Error | null) => void;
  /** Ο ακροατής απέτυχε για λόγο άλλο από δικαίωμα — ο καλών πέφτει σε εφάπαξ ανάγνωση. */
  readonly onFallback: () => void;
}

/** Same constraints as getFilesByEntity — the owner constraint is REQUIRED by the Security Rules. */
function realtimeConstraints(params: UseEntityFilesRealtimeParams): QueryConstraint[] {
  const { custody, entityType, entityId, domain, category, levelFloorId } = params;
  return [
    ...fileOwnerConstraints(custody),
    where('entityType', '==', entityType),
    where('entityId', '==', entityId),
    where('status', '==', FILE_STATUS.READY),
    where('isDeleted', '==', false),
    where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
    ...(domain ? [where('domain', '==', domain)] : []),
    ...(category ? [where('category', '==', category)] : []),
    ...(levelFloorId ? [where('levelFloorId', '==', levelFloorId)] : []),
  ];
}

export function useEntityFilesRealtime(params: UseEntityFilesRealtimeParams): void {
  const { enabled, entityType, entityId, custody, domain, category, purpose, scopes, levelFloorId } = params;

  // Stable refs — avoids subscription re-creation on every render
  const purposeRef = useRef(purpose);
  useEffect(() => { purposeRef.current = purpose; }, [purpose]);
  const callbacksRef = useRef(params);
  useEffect(() => { callbacksRef.current = params; });

  useEffect(() => {
    if (!enabled || !entityId || !custody) return;
    const { onFiles, onLoading, onError, onFallback } = callbacksRef.current;

    onLoading(true);
    const constraints = realtimeConstraints(params);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      FILE_COLLECTION[fileReadKindOf(custody)],
      (result: QueryResult<DocumentData>) => {
        const filterByPurpose = buildFileReadFilter(purposeRef.current, scopes);
        const records = result.documents
          .map(doc => toFileRecord(doc))
          .filter((r): r is FileRecord => r !== null)
          .filter(FileRecordService.isVisibleInActiveLists)
          .filter(filterByPurpose);

        onFiles(records);
        onLoading(false);
        onError(null);
        logger.info('[realtime] Files updated', { count: records.length, entityType, entityId });
      },
      (err: unknown) => {
        const code = (err as { code?: string })?.code ?? 'unknown';
        // Permission errors are expected (auth loading, unsaved entities)
        if (isPermissionDeniedError(err)) {
          logger.warn('[realtime] Permission denied (expected)', { entityType, entityId });
          onFiles([]);
          onLoading(false);
          return;
        }
        logger.warn('[realtime] Listener failed, falling back to one-time fetch', { code, entityType, entityId });
        onFallback();
      },
      { constraints },
    );

    return () => {
      unsubscribe();
    };
  }, [enabled, entityType, entityId, custody, domain, category, scopes, levelFloorId]);
}
