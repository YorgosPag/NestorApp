'use client';

/**
 * @fileoverview **ΟΙ ΦΩΤΟΓΡΑΦΟΙ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ, ΑΠΟ ΤΗΝ ΟΘΟΝΗ ΤΟΥ ΥΠΕΥΘΥΝΟΥ** — εκκρεμείς προσκλήσεις + άδειες, και οι πράξεις.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `services/spatial-tour/spatial-tour.client.ts`
 * @module components/spatial-tour/useTourPhotographers
 *
 * 🔑 **Ανάκληση = αισιόδοξη** (η γραμμή φεύγει αμέσως· σε άρνηση ξαναδιαβάζεται η αλήθεια — Κ3β, `useReconciledResource`).
 * **Έκδοση = πάντα συμφιλίωση**: ανακαλεί **σιωπηλά** την προηγούμενη πρόσκληση προς τον ίδιο άνθρωπο (supersede) —
 * μόνο ο διακομιστής ξέρει το αποτέλεσμα.
 * 🔑 Η **περιήγηση που δεν υπάρχει ακόμη** δεν είναι σφάλμα: `tour-absent` ⇒ κενές λίστες (η πρώτη πρόσκληση τη γεννά).
 */

import { useCallback, useState } from 'react';

import { useReconciledResource } from '@/hooks/useReconciledResource';

import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import {
  issueTourCaptureInvitationFromScreen,
  listTourCaptureGrantsFromScreen,
  listTourCaptureInvitationsFromScreen,
  revokeTourCaptureGrantFromScreen,
  revokeTourCaptureInvitationFromScreen,
  tourListOrEmpty,
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

async function loadPhotographers(subject: TourSubject): Promise<PhotographersLoad> {
  const [invitations, grants] = await Promise.all([
    listTourCaptureInvitationsFromScreen(subject),
    listTourCaptureGrantsFromScreen(subject),
  ]);
  const i = tourListOrEmpty(invitations);
  const g = tourListOrEmpty(grants);
  return i === null || g === null ? { kind: 'failed' } : { kind: 'loaded', invitations: i, grants: g };
}

function actOf<T>(result: TourCallResult<T>): PhotographerActResult | null {
  if (result.kind === 'ok') return null;
  return result.kind === 'refused' ? result : { kind: 'failed' };
}

interface PhotographersSnapshot {
  readonly invitations: readonly TourCaptureInvitationView[];
  readonly grants: readonly TourCaptureGrantView[];
}

export function useTourPhotographers(subject: TourSubject) {
  const [last, setLast] = useState<PhotographerActResult | null>(null);
  const [busy, setBusy] = useState(false);
  const loader = useCallback(async (): Promise<PhotographersSnapshot | null> => {
    const loaded = await loadPhotographers(subject);
    return loaded.kind === 'loaded' ? { invitations: loaded.invitations, grants: loaded.grants } : null;
  }, [subject]);
  const { data, status, refresh, optimistic } = useReconciledResource(loader);

  const load: PhotographersLoad = data !== null
    ? { kind: 'loaded', invitations: data.invitations, grants: data.grants }
    : status === 'error' ? { kind: 'failed' } : { kind: 'loading' };

  const issue = useCallback(async (input: { readonly email: string; readonly grantExpiresAt: string; readonly reason: string }) => {
    setBusy(true);
    const result = await optimistic((current) => current, () => issueTourCaptureInvitationFromScreen(subject, input), { reconcile: 'always' });
    setLast(result.kind === 'ok' ? { kind: 'issued', issued: result.value } : actOf(result));
    setBusy(false);
  }, [optimistic, subject]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    const result = await optimistic(
      (current) => ({ ...current, invitations: current.invitations.filter((row) => row.id !== invitationId) }),
      () => revokeTourCaptureInvitationFromScreen(subject, invitationId),
      { failed: (outcome) => outcome.kind !== 'ok' },
    );
    setLast(actOf(result));
  }, [optimistic, subject]);

  const revokeGrant = useCallback(async (granteeUid: string) => {
    const result = await optimistic(
      (current) => ({ ...current, grants: current.grants.filter((row) => row.granteeUid !== granteeUid) }),
      () => revokeTourCaptureGrantFromScreen(subject, granteeUid),
      { failed: (outcome) => outcome.kind !== 'ok' },
    );
    setLast(actOf(result));
  }, [optimistic, subject]);

  return { load, last, busy, refresh, issue, revokeInvitation, revokeGrant };
}
