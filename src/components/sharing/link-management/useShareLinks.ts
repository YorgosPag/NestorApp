/**
 * =============================================================================
 * useShareLinks — οι ενεργοί σύνδεσμοι μιας οντότητας (ADR-315 §5)
 * =============================================================================
 *
 * Λίστα + ανάκληση + «ανάκληση όλων» + αλλαγή ρυθμίσεων, **μόνο** μέσω της πρόσοψης
 * `UnifiedSharingService` (οι συλλογές είναι `if false` για τον browser).
 *
 * 🔑 **Αισιόδοξα, με συμφιλίωση** (Gmail/Drive): η γραμμή φεύγει **αμέσως** από την οθόνη·
 * αν ο διακομιστής αρνηθεί, **ξαναδιαβάζουμε** την αλήθεια αντί να μαντέψουμε τι να
 * επαναφέρουμε (η αποτυχία μπορεί να ήταν μισή — π.χ. «ανάκληση όλων» που πέρασε σε μία παρτίδα).
 *
 * 🔑 **Κανένας αγώνας αναγνώσεων**: κάθε ανάγνωση παίρνει αύξοντα αριθμό· εφαρμόζεται **μόνο** η
 * τελευταία. Μια αργή παλιά απάντηση δεν σβήνει ποτέ μια νεότερη.
 *
 * @module components/sharing/link-management/useShareLinks
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type { ShareEntityType, ShareLinkSummary, UpdateShareRequest } from '@/types/sharing';

export type ShareLinksStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseShareLinksOptions {
  readonly entityType: ShareEntityType;
  readonly entityId: string;
  /** `false` ⇒ καμία ανάγνωση (κλειστός διάλογος, ή σύνδεσμος που δεν διαχειρίζεται εδώ). */
  readonly enabled: boolean;
}

export interface UseShareLinksResult {
  readonly links: readonly ShareLinkSummary[];
  readonly hasMore: boolean;
  readonly status: ShareLinksStatus;
  readonly refresh: () => Promise<void>;
  /** Αισιόδοξη ανάκληση. Πετά σε αποτυχία (ο καλών δείχνει μήνυμα· η λίστα συμφιλιώνεται). */
  readonly revoke: (shareId: string) => Promise<void>;
  readonly revokeAll: (exceptShareId?: string) => Promise<number>;
  readonly update: (shareId: string, request: UpdateShareRequest) => Promise<ShareLinkSummary>;
}

export function useShareLinks({ entityType, entityId, enabled }: UseShareLinksOptions): UseShareLinksResult {
  const [links, setLinks] = useState<readonly ShareLinkSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<ShareLinksStatus>('idle');
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    try {
      const result = await UnifiedSharingService.listActive(entityType, entityId);
      if (mine !== seq.current) return;
      setLinks(result.links);
      setHasMore(result.hasMore);
      setStatus('ready');
    } catch {
      if (mine === seq.current) setStatus('error');
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  /** Αισιόδοξη αλλαγή + συμφιλίωση σε αποτυχία. */
  const optimistic = useCallback(
    async <T,>(apply: (rows: readonly ShareLinkSummary[]) => readonly ShareLinkSummary[], call: () => Promise<T>) => {
      seq.current++; // ακύρωσε κάθε ανάγνωση σε πτήση — θα έφερνε την προ-αλλαγής εικόνα
      setLinks(apply);
      try {
        return await call();
      } catch (error) {
        void refresh();
        throw error;
      }
    },
    [refresh],
  );

  const revoke = useCallback(
    (shareId: string) =>
      optimistic((rows) => rows.filter((row) => row.shareId !== shareId), () => UnifiedSharingService.revoke(shareId)),
    [optimistic],
  );

  const revokeAll = useCallback(
    async (exceptShareId?: string) => {
      const result = await optimistic(
        (rows) => rows.filter((row) => row.shareId === exceptShareId),
        () => UnifiedSharingService.revokeAll({ entityType, entityId, ...(exceptShareId ? { exceptShareId } : {}) }),
      );
      void refresh(); // «ανάκληση όλων» αγγίζει και ό,τι δεν χωρούσε στη σελίδα
      return result.revoked;
    },
    [optimistic, refresh, entityType, entityId],
  );

  const update = useCallback(
    async (shareId: string, request: UpdateShareRequest) => {
      const link = await UnifiedSharingService.update(shareId, request);
      setLinks((rows) => rows.map((row) => (row.shareId === shareId ? link : row)));
      return link;
    },
    [],
  );

  return { links, hasMore, status, refresh, revoke, revokeAll, update };
}
