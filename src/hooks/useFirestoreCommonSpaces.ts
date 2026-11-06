'use client';

/**
 * Κοινόχρηστοι χώροι — συνδρομή πραγματικού χρόνου (ADR-931).
 *
 * `firestoreQueryService.subscribe()` (onSnapshot, ADR-227): το φίλτρο `companyId` το προσθέτει
 * η υπηρεσία (tenant-config default) — ο κανόνας `common_spaces` αποδεικνύεται **από αυτό**.
 * Προαιρετικό φίλτρο κτιρίου για την καρτέλα του κτιρίου.
 *
 * Η λίστα ενημερώνεται σταδιακά από το snapshot: δημιουργία/ενημέρωση/κάδος φαίνονται
 * χωρίς refetch (Google Docs-style live data).
 */

import { useEffect, useMemo, useState } from 'react';
import { where, type DocumentData } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import { firestoreQueryService, type QueryResult } from '@/services/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { isRetired } from '@/lib/firestore/trashed-status';
import { mapCommonSpaceDoc } from '@/lib/common-spaces/common-space-mapper';
import type { CommonSpace } from '@/types/common-space';

const logger = createModuleLogger('useFirestoreCommonSpaces');

interface UseFirestoreCommonSpacesOptions {
  /** Μόνο οι χώροι αυτού του κτιρίου. */
  readonly buildingId?: string;
  /** `false` ⇒ καμία συνδρομή (π.χ. καμβάς χωρίς περίγραμμα κοινόχρηστου). Προεπιλογή `true`. */
  readonly enabled?: boolean;
}

export interface UseFirestoreCommonSpacesReturn {
  readonly commonSpaces: readonly CommonSpace[];
  readonly loading: boolean;
  readonly error: string | null;
}

function toCommonSpaces(result: QueryResult<DocumentData>): CommonSpace[] {
  return result.documents
    .map(({ id, ...rest }) => mapCommonSpaceDoc(String(id), rest))
    .filter((space) => !isRetired(space));
}

export function useFirestoreCommonSpaces(
  options: UseFirestoreCommonSpacesOptions = {},
): UseFirestoreCommonSpacesReturn {
  const { buildingId, enabled: requested = true } = options;
  const { user, loading: authLoading } = useAuth();
  const [commonSpaces, setCommonSpaces] = useState<readonly CommonSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enabled = requested && !authLoading && !!user;
  const constraints = useMemo(
    () => (buildingId ? [where('buildingId', '==', buildingId)] : []),
    [buildingId],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(requested && authLoading);
      return;
    }
    setLoading(true);
    setError(null);
    return firestoreQueryService.subscribe<DocumentData>(
      'COMMON_SPACES',
      (result) => {
        setCommonSpaces(toCommonSpaces(result));
        setLoading(false);
      },
      (err: Error) => {
        logger.error('Common spaces subscription error', { error: err.message, buildingId });
        setError(err.message);
        setLoading(false);
      },
      { constraints },
    );
  }, [enabled, requested, authLoading, constraints, buildingId]);

  return { commonSpaces, loading, error };
}
