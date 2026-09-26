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

import { useCallback } from 'react';

import { useReconciledResource, type ReconciledStatus } from '@/hooks/useReconciledResource';

import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type { ShareEntityType, ShareLinkSummary, UpdateShareRequest } from '@/types/sharing';

export type ShareLinksStatus = ReconciledStatus;

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

interface ShareLinksSnapshot {
  readonly links: readonly ShareLinkSummary[];
  readonly hasMore: boolean;
}

export function useShareLinks({ entityType, entityId, enabled }: UseShareLinksOptions): UseShareLinksResult {
  // ♻️ Αισιόδοξη αλλαγή + συμφιλίωση + ακύρωση πτήσης: ο ΕΝΑΣ τρόπος (`hooks/useReconciledResource`, ADR-884 Κ3β).
  const load = useCallback(
    (): Promise<ShareLinksSnapshot> => UnifiedSharingService.listActive(entityType, entityId),
    [entityType, entityId],
  );
  const { data, status, refresh, optimistic } = useReconciledResource(load, enabled);

  const revoke = useCallback(
    async (shareId: string) => {
      await optimistic(
        (current) => ({ ...current, links: current.links.filter((row) => row.shareId !== shareId) }),
        () => UnifiedSharingService.revoke(shareId),
      );
    },
    [optimistic],
  );

  const revokeAll = useCallback(
    async (exceptShareId?: string) => {
      const result = await optimistic(
        (current) => ({ ...current, links: current.links.filter((row) => row.shareId === exceptShareId) }),
        () => UnifiedSharingService.revokeAll({ entityType, entityId, ...(exceptShareId ? { exceptShareId } : {}) }),
        // «ανάκληση όλων» αγγίζει και ό,τι δεν χωρούσε στη σελίδα
        { reconcile: 'always' },
      );
      return result.revoked;
    },
    [optimistic, entityType, entityId],
  );

  const update = useCallback(
    async (shareId: string, request: UpdateShareRequest) => {
      const link = await UnifiedSharingService.update(shareId, request);
      await optimistic(
        (current) => ({ ...current, links: current.links.map((row) => (row.shareId === shareId ? link : row)) }),
        () => Promise.resolve(link),
      );
      return link;
    },
    [optimistic],
  );

  return { links: data?.links ?? [], hasMore: data?.hasMore ?? false, status, refresh, revoke, revokeAll, update };
}
