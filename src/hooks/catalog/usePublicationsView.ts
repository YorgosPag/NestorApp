'use client';

/**
 * @fileoverview **Η όψη του εκδότη καταλόγου, ζωντανή όσο τρέχει έκδοση** — συνταγές + πρόσφατες εκδόσεις
 *   (ADR-923 §5.6.1).
 * @related services/catalog/catalog-publishing-api.client.ts (η ανάγνωση) · hooks/catalog/usePricingView.ts (το ίδιο ιδίωμα φόρτωσης)
 * @module hooks/catalog/usePublicationsView
 *
 * 🔑 **Ρολόι μόνο όσο χρειάζεται**: η όψη δεν έχει σήμα όψης — η πρόοδος μιας έκδοσης γράφεται από τον διακομιστή στο
 *    παρασκήνιο. Όσο υπάρχει έκδοση `queued`/`running` ξαναδιαβάζουμε κάθε {@link PUBLICATION_POLL_MS}· μόλις όλες
 *    τελειώσουν (ή ο άνθρωπος φύγει από τη σελίδα) το ρολόι σταματά. Ποτέ ατέρμονη ανάγνωση σε ησυχία.
 * 🔑 **Stale-while-revalidate**: η ανανέωση δεν δείχνει «φορτώνει»· αποτυχημένη ανανέωση κρατά ό,τι φαίνεται.
 * ⚠️ **Μονοτονία**: απάντηση που ξεκίνησε πριν από νεότερη ανάγνωση απορρίπτεται — αργή απάντηση δεν γυρίζει την οθόνη πίσω.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import { fetchPublicationsView } from '@/services/catalog/catalog-publishing-api.client';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import type { PublicationRunWire, PublicationsViewWire } from '@/subapps/catalog/types/publication';

/** Κάθε πότε ξαναδιαβάζεται η όψη όσο υπάρχει έκδοση σε εξέλιξη. */
export const PUBLICATION_POLL_MS = 3000;

export type PublicationsViewState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed'; readonly failure: CatalogFailure }
  | { readonly state: 'ready'; readonly view: PublicationsViewWire };

export interface PublicationsViewApi {
  readonly current: PublicationsViewState;
  /** Ρητή ξαναφόρτωση (κουμπί «Δοκιμάστε ξανά»). */
  readonly reload: () => void;
  /** Ανανέωση στο παρασκήνιο μετά από πράξη της ίδιας οθόνης. */
  readonly revalidate: () => Promise<void>;
}

type Load = { readonly kind: 'ready'; readonly view: PublicationsViewWire } | { readonly kind: 'failed'; readonly failure: CatalogFailure };

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ «δεν επιτρέπεται», όχι ατέρμονο «φορτώνει». */
const NOBODY: Load = { kind: 'failed', failure: { kind: 'forbidden', issues: [], currentRevision: null, fence: null } };

/** Η νεότερη όψη του παρασκηνίου, δεμένη στη φόρτωση πάνω στην οποία ήρθε. */
interface Fresher {
  readonly base: PublicationsViewWire;
  readonly next: PublicationsViewWire;
}

export const isPublicationRunActive = (run: Pick<PublicationRunWire, 'status'>): boolean => run.status === 'queued' || run.status === 'running';

async function readOnce(): Promise<Load> {
  try {
    return { kind: 'ready', view: await fetchPublicationsView() };
  } catch (cause) {
    return { kind: 'failed', failure: catalogFailureOf(cause) };
  }
}

function useBackgroundRead(base: PublicationsViewWire | null) {
  const [fresher, setFresher] = useState<Fresher | null>(null);
  const issued = useRef(0);
  const applied = useRef(0);
  const revalidate = useCallback(async (): Promise<void> => {
    if (base === null) return;
    const ticket = ++issued.current;
    const next = await fetchPublicationsView().catch(() => null);
    if (next === null || ticket < applied.current) return;
    applied.current = ticket;
    setFresher({ base, next });
  }, [base]);
  const shown = fresher !== null && fresher.base === base ? fresher.next : base;
  return { shown, revalidate };
}

export function usePublicationsView(): PublicationsViewApi {
  const { value: loaded, reload } = useIdentityGatedResource<Load>(readOnce, NOBODY);
  const base = loaded?.kind === 'ready' ? loaded.view : null;
  const { shown, revalidate } = useBackgroundRead(base);
  const active = shown !== null && shown.runs.some(isPublicationRunActive);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => { void revalidate(); }, PUBLICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [active, revalidate]);

  if (loaded === null) return { current: { state: 'loading' }, reload, revalidate };
  if (loaded.kind === 'failed') return { current: { state: 'failed', failure: loaded.failure }, reload, revalidate };
  return { current: { state: 'ready', view: shown ?? loaded.view }, reload, revalidate };
}
