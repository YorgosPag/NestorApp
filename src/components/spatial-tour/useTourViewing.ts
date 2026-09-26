'use client';

/**
 * @fileoverview **Η ΘΕΑΣΗ ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΤΟΥ ΥΠΕΥΘΥΝΟΥ** — ρυθμίσεις + αιτήματα, αισιόδοξα με συμφιλίωση (ADR-884 Κ3β).
 * @related `hooks/useReconciledResource.ts` (ο ΕΝΑΣ τρόπος) · `services/spatial-tour/spatial-tour-viewing.client.ts`
 * @module components/spatial-tour/useTourViewing
 *
 * 🔑 **Αισιόδοξα, όπως Gmail/Drive**: η αλλαγή ρύθμισης φαίνεται αμέσως· η εγκεκριμένη γραμμή **φεύγει** αμέσως από τα
 * εκκρεμή· η ανακλημένη **φεύγει** αμέσως από όσους έχουν πρόσβαση. Σε άρνηση του διακομιστή ⇒ ξαναδιάβασμα της αλήθειας.
 * 🔑 **Η μαζική απόφαση συμφιλιώνεται ΠΑΝΤΑ**: το αποτέλεσμα είναι ανά άνθρωπο (κάποιος μπορεί να αποσύρθηκε στο μεταξύ),
 * και οι εγκεκριμένοι πρέπει να εμφανιστούν στη λίστα «με πρόσβαση» με ό,τι ξέρει ο διακομιστής (επαφή CRM, λήξη).
 */

import { useCallback, useState } from 'react';

import type { TourAccessRequestState } from '@/constants/spatial-tour-vocabulary';
import { useReconciledResource } from '@/hooks/useReconciledResource';
import type { TourAccessInboxRow } from '@/server/spatial-tour/tour-access-inbox';
import type { TourSettings } from '@/server/spatial-tour/tour-settings';
import { tourListOrEmpty, type TourCallResult } from '@/services/spatial-tour/spatial-tour.client';
import {
  decideTourAccessFromScreen,
  listTourAccessRequestsFromScreen,
  readTourSettingsFromScreen,
  revokeTourAccessFromScreen,
  updateTourSettingsFromScreen,
  type TourDecisionRow,
} from '@/services/spatial-tour/spatial-tour-viewing.client';
import type { TourSubject } from '@/types/spatial-tour';

/** Η τελευταία έκβαση — `null` ⇒ τίποτα να ειπωθεί. */
export type TourViewingNotice =
  | { readonly kind: 'saved' }
  | { readonly kind: 'decided'; readonly rows: readonly TourDecisionRow[] }
  | { readonly kind: 'refused'; readonly result: Extract<TourCallResult<unknown>, { kind: 'refused' }> }
  | { readonly kind: 'failed' };

function noticeOf<T>(result: TourCallResult<T>): TourViewingNotice | null {
  if (result.kind === 'ok') return null;
  return result.kind === 'refused' ? { kind: 'refused', result } : { kind: 'failed' };
}

export interface TourSettingsState {
  readonly tourId: string;
  readonly settings: TourSettings;
}

export function useTourSettings(subject: TourSubject) {
  const [notice, setNotice] = useState<TourViewingNotice | null>(null);
  const load = useCallback(async (): Promise<TourSettingsState | null> => {
    const result = await readTourSettingsFromScreen(subject);
    return result.kind === 'ok' ? { tourId: result.value.tourId, settings: result.value.settings } : null;
  }, [subject]);
  const { data, status, refresh, optimistic } = useReconciledResource(load);

  const update = useCallback(async (settings: TourSettings) => {
    const result = await optimistic(
      (current) => ({ ...current, settings }),
      () => updateTourSettingsFromScreen(subject, settings),
      { failed: (outcome) => outcome.kind !== 'ok' },
    );
    setNotice(result.kind === 'ok' ? { kind: 'saved' } : noticeOf(result));
  }, [optimistic, subject]);

  return { state: data, status, refresh, update, notice };
}

export function useTourAccessRequests(subject: TourSubject, state: TourAccessRequestState) {
  const [notice, setNotice] = useState<TourViewingNotice | null>(null);
  const load = useCallback(async () => tourListOrEmpty(await listTourAccessRequestsFromScreen(subject, state)), [subject, state]);
  const { data, status, refresh, optimistic } = useReconciledResource<readonly TourAccessInboxRow[]>(load);

  const decide = useCallback(async (requesterUids: readonly string[], decision: 'approved' | 'declined', expiresAt: string | null) => {
    const chosen = new Set(requesterUids);
    const result = await optimistic(
      (rows) => rows.filter((row) => !chosen.has(row.requesterUid)),
      () => decideTourAccessFromScreen(subject, { requesterUids, decision, expiresAt }),
      { reconcile: 'always' },
    );
    setNotice(result.kind === 'ok' ? { kind: 'decided', rows: result.value } : noticeOf(result));
  }, [optimistic, subject]);

  const revoke = useCallback(async (requesterUid: string) => {
    const result = await optimistic(
      (rows) => rows.filter((row) => row.requesterUid !== requesterUid),
      () => revokeTourAccessFromScreen(subject, requesterUid),
      { failed: (outcome) => outcome.kind !== 'ok' },
    );
    setNotice(noticeOf(result));
  }, [optimistic, subject]);

  return { rows: data, status, refresh, decide, revoke, notice };
}
