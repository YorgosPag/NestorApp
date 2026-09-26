'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΚΑΡΤΑΣ ΠΕΡΙΗΓΗΣΗΣ** — παρουσία (δημόσια) + το δικό μου αίτημα (με λογαριασμό) (ADR-884 Κ3β).
 * @related `TourAccessCard.tsx` · `services/spatial-tour/spatial-tour-viewing.client.ts`
 * @module components/spatial-tour/useTourAccessCard
 *
 * 🔑 **Δύο ερωτήσεις, δύο πόρτες**: «έχει η αγγελία περιήγηση που φαίνεται;» (δημόσια, χωρίς ταυτότητα) και «πού
 * είναι το αίτημά μου;» (με λογαριασμό). Η δεύτερη ρωτιέται **μόνο** για περιήγηση κατ' αίτηση και συνδεδεμένο.
 * 🔑 **Αισιόδοξα**: το αίτημα/η απόσυρση αλλάζουν την κάρτα αμέσως με την απάντηση του διακομιστή (ποτέ εικασία).
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import type { MyTourAccessView } from '@/app/api/spatial-tours/[kind]/[subjectId]/my-access/route';
import type { TourPresence } from '@/server/spatial-tour/tour-presence';
import {
  readMyTourAccessFromScreen,
  readTourPresenceFromScreen,
  requestTourAccessFromScreen,
  withdrawTourAccessFromScreen,
} from '@/services/spatial-tour/spatial-tour-viewing.client';

export type TourAccessCardState =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'open' }
  | { readonly kind: 'sign-in' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'approved'; readonly expiresAt: string }
  | { readonly kind: 'requestable'; readonly previous: 'declined' | 'expired' | 'revoked' | null };

/** Το αίτημά μου → κάρτα. Ο υπεύθυνος βλέπει «άνοιγμα» — δεν ζητά πρόσβαση στη δική του περιήγηση. */
function stateOf(mine: MyTourAccessView): TourAccessCardState {
  if (mine.manages) return { kind: 'open' };
  switch (mine.standing) {
    case 'active': return mine.expiresAt === null ? { kind: 'open' } : { kind: 'approved', expiresAt: mine.expiresAt };
    case 'pending': return { kind: 'pending' };
    case 'declined': case 'expired': case 'revoked': return { kind: 'requestable', previous: mine.standing };
    default: return { kind: 'requestable', previous: null };
  }
}

export function useTourAccessCard(listingId: string) {
  const { user, loading } = useAuth();
  const [presence, setPresence] = useState<TourPresence | null>(null);
  const [state, setState] = useState<TourAccessCardState>({ kind: 'hidden' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = user !== null;

  useEffect(() => {
    let live = true;
    void readTourPresenceFromScreen(listingId).then((result) => {
      if (live && result.kind === 'ok') setPresence(result.value);
    });
    return () => { live = false; };
  }, [listingId]);

  useEffect(() => {
    if (presence === null || loading) return;
    if (presence.visibility === 'public') { setState({ kind: 'open' }); return; }
    if (!signedIn) { setState({ kind: 'sign-in' }); return; }
    let live = true;
    void readMyTourAccessFromScreen(presence.subject).then((result) => {
      if (live && result.kind === 'ok') setState(stateOf(result.value));
    });
    return () => { live = false; };
  }, [presence, signedIn, loading]);

  const run = useCallback(async (call: () => Promise<{ readonly kind: string; readonly value?: unknown }>, onOk: () => void) => {
    setBusy(true);
    setFailed(false);
    const result = await call();
    if (result.kind === 'ok') onOk(); else setFailed(true);
    setBusy(false);
  }, []);

  const request = useCallback(async (message: string | null) => {
    if (presence === null) return;
    const subject = presence.subject;
    let next: TourAccessCardState = { kind: 'pending' };
    await run(async () => {
      const result = await requestTourAccessFromScreen(subject, message);
      if (result.kind === 'ok') next = stateOf(result.value);
      return result;
    }, () => setState(next));
  }, [presence, run]);

  const withdraw = useCallback(async () => {
    if (presence === null) return;
    const subject = presence.subject;
    await run(() => withdrawTourAccessFromScreen(subject), () => setState({ kind: 'requestable', previous: null }));
  }, [presence, run]);

  return { state, busy, failed, request, withdraw };
}
