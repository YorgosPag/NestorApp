'use client';

/**
 * @fileoverview **Η κατάσταση του μητρώου λήξεων** — φόρτωση, ξαναφόρτωση, και ανανέωση **ακριβώς** όταν μπαγιατεύει.
 * @related ADR-915 Φ4γ · hooks/useIdentityGatedResource.ts · services/realtime/hooks/use-server-view-signal.ts
 * @module hooks/document-registry/useDocumentRegistry
 *
 * 🔑 **Δύο μηχανισμοί που ΥΠΑΡΧΟΥΝ ήδη, κανένας νέος:**
 *  1. {@link useIdentityGatedResource} — η πρώτη ανάγνωση **μόνο** αφού λυθεί η ταυτότητα (περιστατικό 0/251 αιτήματα).
 *  2. {@link useServerViewSignal} με `source: null` — **κανένα** έγγραφο-σήμα (το μητρώο δεν έχει γραφέα να το
 *     ειδοποιήσει), αλλά ο ίδιος ελεγκτής δίνει: χρονόμετρο στο `freshUntil` (αλλαγή ημέρας Ελλάδας: οι καταστάσεις
 *     αλλάζουν **μόνες τους**), επανασύνδεση δικτύου, ορατότητα καρτέλας. Ίδιο ιδίωμα με την υπόθεση (ADR-901 §14.8).
 *
 * 🔴 **Η ανανέωση γίνεται στο ΠΑΡΑΣΚΗΝΙΟ** (stale-while-revalidate, ιδίωμα `useConveyanceCase`): τα δεδομένα μένουν
 *    στην οθόνη χωρίς «φορτώνει». Μια αποτυχημένη ανανέωση **κρατά** τα παλιά — και η κεφαλίδα δείχνει πάντα το `asOf`
 *    τους, οπότε η παλαιότητα είναι **ορατή**, ποτέ σιωπηλή.
 *
 * ⚠️ **Μονοτονική αποδοχή**: απάντηση με **παλαιότερο** `asOf` από αυτό που ήδη δείχνουμε απορρίπτεται — δύο αναγνώσεις
 *    σε πτήση γύρω από τα μεσάνυχτα δεν επιτρέπεται να γυρίσουν την οθόνη στο «χθες».
 */

import { useCallback, useState } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import { useServerViewSignal } from '@/services/realtime/hooks/use-server-view-signal';
import { fetchDocumentRegistry, type RegistryLoad } from '@/services/document-registry/document-registry.client';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

/** Λύθηκε η ταυτότητα και **δεν υπάρχει κανείς** — όχι σιωπή, αλλά αποτυχία (ίδια απόφαση με τον κατάλογο εντολών). */
const UNAUTHENTICATED: RegistryLoad = { kind: 'failed', message: 'unauthenticated' };

/** Το μητρώο δεν έχει έγγραφο-σήμα: η αναθεώρηση είναι πάντα 0 και ο ελεγκτής ξαναρωτά μόνο με ρολόι/δίχτυ. */
const NO_SIGNAL_REVISION = 0;
const noSignalRevision = (): number | null => null;

export type DocumentRegistryState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly registry: DocumentRegistryResponse };

export interface DocumentRegistryApi {
  readonly view: DocumentRegistryState;
  /** Ρητή ξαναφόρτωση (κουμπί «Δοκιμάστε ξανά») — σταθερή αναφορά. */
  readonly reload: () => void;
  /**
   * ADR-915 §26 — ξαναδιάβασμα **στο παρασκήνιο** μετά από πράξη της ίδιας οθόνης (π.χ. ορισμός υπευθύνου): τα δεδομένα
   * μένουν ορατά, χωρίς «φορτώνει» (το `reload` θα έσβηνε τη σελίδα), με την ίδια μονοτονική αποδοχή.
   */
  readonly revalidate: () => Promise<void>;
}

/** Η νεότερη απάντηση που δέχτηκε το παρασκήνιο, **δεμένη** στη φόρτωση πάνω στην οποία ήρθε. */
interface Fresher {
  readonly base: DocumentRegistryResponse;
  readonly next: DocumentRegistryResponse;
}

const shownOf = (fresher: Fresher | null, base: DocumentRegistryResponse | null): DocumentRegistryResponse | null =>
  fresher !== null && fresher.base === base ? fresher.next : base;

/** Δεκτή μόνο αν δεν γυρίζει πίσω την «σήμερα» (τα `asOf` είναι κλειδιά `YYYY-MM-DD`: λεξικογραφικά = χρονολογικά). */
function acceptFresher(prev: Fresher | null, base: DocumentRegistryResponse, next: DocumentRegistryResponse): Fresher | null {
  const shown = shownOf(prev, base) ?? base;
  return next.asOf >= shown.asOf ? { base, next } : prev;
}

/** Stale-while-revalidate πάνω στη φόρτωση `base`. Επιστρέφει ό,τι πρέπει να δείχνει η οθόνη, και την ανανέωση. */
function useBackgroundRefresh(base: DocumentRegistryResponse | null): {
  readonly shown: DocumentRegistryResponse | null;
  readonly revalidate: () => Promise<void>;
} {
  const [fresher, setFresher] = useState<Fresher | null>(null);
  const shown = shownOf(fresher, base);

  const fetch = useCallback(async (): Promise<number | null> => {
    if (base === null) return null;
    const load = await fetchDocumentRegistry();
    if (load.kind === 'ready') setFresher((prev) => acceptFresher(prev, base, load.registry));
    return NO_SIGNAL_REVISION;
  }, [base]);

  useServerViewSignal({
    source: null,
    revisionOf: noSignalRevision,
    freshness: shown === null ? 'pending' : { revision: NO_SIGNAL_REVISION, freshUntil: shown.freshUntil },
    fetch,
    label: 'document-registry',
  });

  const revalidate = useCallback(async () => { await fetch(); }, [fetch]);
  return { shown, revalidate };
}

export function useDocumentRegistry(): DocumentRegistryApi {
  const { value: loaded, reload } = useIdentityGatedResource<RegistryLoad>(fetchDocumentRegistry, UNAUTHENTICATED);
  const { shown, revalidate } = useBackgroundRefresh(loaded?.kind === 'ready' ? loaded.registry : null);

  if (loaded === null) return { view: { state: 'loading' }, reload, revalidate };
  if (shown === null) return { view: { state: 'failed' }, reload, revalidate };
  return { view: { state: 'ready', registry: shown }, reload, revalidate };
}
