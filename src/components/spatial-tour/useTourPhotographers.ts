'use client';

/**
 * @fileoverview **ΟΙ ΦΩΤΟΓΡΑΦΟΙ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΤΟΥ ΥΠΕΥΘΥΝΟΥ** — εκκρεμείς προσκλήσεις + άδειες, και οι πράξεις.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `services/spatial-tour/spatial-tour.client.ts`
 * @module components/spatial-tour/useTourPhotographers
 *
 * 🔑 **Μετά από κάθε πράξη ξαναδιαβάζει από τον διακομιστή** (όχι αισιόδοξη εικασία): η έκδοση ανακαλεί **σιωπηλά** την
 * προηγούμενη πρόσκληση προς τον ίδιο άνθρωπο (supersede) — μόνο ο διακομιστής ξέρει το αποτέλεσμα. Οι λίστες
 * είναι μικρές (φραγμένες) και η πράξη σπάνια, άρα η ακρίβεια κοστίζει ένα αίτημα.
 * 🔑 Η **περιήγηση που δεν υπάρχει ακόμη** δεν είναι σφάλμα: `tour-absent` ⇒ κενές λίστες (η πρώτη πρόσκληση τη γεννά).
 */

import { useCallback, useEffect, useState } from 'react';

import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import {
  issueTourCaptureInvitationFromScreen,
  listTourCaptureGrantsFromScreen,
  listTourCaptureInvitationsFromScreen,
  revokeTourCaptureGrantFromScreen,
  revokeTourCaptureInvitationFromScreen,
  type IssuedTourCaptureInvitation,
  type TourCallResult,
} from '@/services/spatial-tour/spatial-tour.client';
import type { TourCaptureInvitationView } from '@/app/api/spatial-tours/[kind]/[subjectId]/capture-invitations/route';
import type { TourCaptureGrantView } from '@/server/spatial-tour/tour-capture-invitation';
import type { TourSubject } from '@/types/spatial-tour';

export type PhotographersLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly invitations: readonly TourCaptureInvitationView[]; readonly grants: readonly TourCaptureGrantView[] }
  | { readonly kind: 'failed' };

/** Η έκβαση της τελευταίας πράξης — για το μήνυμα κάτω από τη φόρμα. */
export type PhotographerActResult =
  | { readonly kind: 'issued'; readonly issued: IssuedTourCaptureInvitation }
  | { readonly kind: 'refused'; readonly reason: TourRefusalName }
  | { readonly kind: 'failed' };

/** `tour-absent` ⇒ «δεν υπάρχει ακόμη περιήγηση» = κενό, όχι σφάλμα. */
function listOf<T>(result: TourCallResult<readonly T[]>): readonly T[] | null {
  if (result.kind === 'ok') return result.value;
  return result.kind === 'refused' && result.reason === 'tour-absent' ? [] : null;
}

async function loadPhotographers(subject: TourSubject): Promise<PhotographersLoad> {
  const [invitations, grants] = await Promise.all([
    listTourCaptureInvitationsFromScreen(subject),
    listTourCaptureGrantsFromScreen(subject),
  ]);
  const i = listOf(invitations);
  const g = listOf(grants);
  return i === null || g === null ? { kind: 'failed' } : { kind: 'loaded', invitations: i, grants: g };
}

function actOf<T>(result: TourCallResult<T>): PhotographerActResult | null {
  if (result.kind === 'ok') return null;
  return result.kind === 'refused' ? result : { kind: 'failed' };
}

export function useTourPhotographers(subject: TourSubject) {
  const [load, setLoad] = useState<PhotographersLoad>({ kind: 'loading' });
  const [last, setLast] = useState<PhotographerActResult | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => setLoad(await loadPhotographers(subject)), [subject]);
  useEffect(() => { void refresh(); }, [refresh]);

  /** Κάθε πράξη: busy → κλήση → μήνυμα → ανάγνωση της αλήθειας από τον διακομιστή. */
  const act = useCallback(async (run: () => Promise<PhotographerActResult | null>) => {
    setBusy(true);
    setLast(await run());
    await refresh();
    setBusy(false);
  }, [refresh]);

  const issue = useCallback((input: { readonly email: string; readonly grantExpiresAt: string; readonly reason: string }) =>
    act(async () => {
      const result = await issueTourCaptureInvitationFromScreen(subject, input);
      return result.kind === 'ok' ? { kind: 'issued', issued: result.value } : actOf(result);
    }), [act, subject]);

  const revokeInvitation = useCallback((invitationId: string) =>
    act(async () => actOf(await revokeTourCaptureInvitationFromScreen(subject, invitationId))), [act, subject]);

  const revokeGrant = useCallback((granteeUid: string) =>
    act(async () => actOf(await revokeTourCaptureGrantFromScreen(subject, granteeUid))), [act, subject]);

  return { load, last, busy, refresh, issue, revokeInvitation, revokeGrant };
}
