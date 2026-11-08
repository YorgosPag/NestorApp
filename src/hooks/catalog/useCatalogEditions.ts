'use client';

/**
 * @fileoverview **Οι δημοσιευμένες εκδόσεις στην οθόνη** (ADR-923 §5.15.3) — του ιδιοκτήτη και του αγοραστή, με ένα ιδίωμα:
 *   πρώτη ανάγνωση μόνο αφού λυθεί η ταυτότητα, ανανέωση στο παρασκήνιο μετά από πράξη.
 * @related hooks/useIdentityGatedResource.ts (η αναμονή ταυτότητας) · hooks/catalog/usePublicationsView.ts (το ίδιο «νεότερο»)
 * @module hooks/catalog/useCatalogEditions
 *
 * 🔑 **Stale-while-revalidate**: η ανανέωση μετά από δημοσίευση/απόσυρση **δεν** δείχνει «φορτώνει»· αποτυχημένη ανανέωση
 *    κρατά ό,τι φαίνεται. Οι εκδόσεις δεν έχουν σήμα όψης: αλλάζουν μόνο με πράξη **αυτής** της οθόνης.
 * ⚠️ **Μονοτονία**: απάντηση που ξεκίνησε πριν από νεότερη ανάγνωση απορρίπτεται, και το «νεότερο» δένεται στη φόρτωση πάνω
 *    στην οποία ήρθε — νέα πρώτη φόρτωση (άλλος χρήστης, άλλη σχέση) το ακυρώνει.
 */

import { useCallback, useRef, useState } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import { catalogFailureOf, type CatalogFailure } from '@/services/catalog/catalog-failure';
import { fetchBuyerCatalogEditions, fetchOwnedCatalogEditions } from '@/services/catalog/catalog-editions-api.client';
import type { CatalogEditionOwnerView, CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';

export type CatalogEditionsLoad<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'failed'; readonly failure: CatalogFailure }
  | { readonly state: 'ready'; readonly editions: readonly T[] };

type Settled<T> = Exclude<CatalogEditionsLoad<T>, { readonly state: 'loading' }>;

export interface CatalogEditionsApi<T> {
  readonly current: CatalogEditionsLoad<T>;
  /** Ρητή ξαναφόρτωση (κουμπί «Δοκιμάστε ξανά»). */
  readonly reload: () => void;
  /** Ανανέωση στο παρασκήνιο μετά από πράξη της ίδιας οθόνης. */
  readonly revalidate: () => Promise<void>;
}

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ «δεν επιτρέπεται», όχι ατέρμονο «φορτώνει». */
const NOBODY: Settled<never> = { state: 'failed', failure: { kind: 'forbidden', issues: [], currentRevision: null, fence: null } };

function useEditionsResource<T>(read: () => Promise<readonly T[]>): CatalogEditionsApi<T> {
  const settle = useCallback(async (): Promise<Settled<T>> => {
    try {
      return { state: 'ready', editions: await read() };
    } catch (cause) {
      return { state: 'failed', failure: catalogFailureOf(cause) };
    }
  }, [read]);
  const base = useIdentityGatedResource<Settled<T>>(settle, NOBODY);
  const [fresher, setFresher] = useState<{ readonly base: Settled<T>; readonly next: Settled<T> } | null>(null);
  const sequence = useRef(0);
  const loaded = base.value;
  const revalidate = useCallback(async () => {
    const ticket = ++sequence.current;
    const next = await settle();
    if (ticket === sequence.current && next.state === 'ready' && loaded !== null) setFresher({ base: loaded, next });
  }, [settle, loaded]);
  const current: CatalogEditionsLoad<T> = loaded === null ? { state: 'loading' } : fresher !== null && fresher.base === loaded ? fresher.next : loaded;
  return { current, reload: base.reload, revalidate };
}

/** Ό,τι έχει δημοσιεύσει ο χώρος (με τις αποσυρμένες). */
export function useOwnedCatalogEditions(): CatalogEditionsApi<CatalogEditionOwnerView> {
  return useEditionsResource(fetchOwnedCatalogEditions);
}

/** Τα έντυπα ενός προμηθευτή που βλέπει ο αγοραστής μέσω της σχέσης του. */
export function useBuyerCatalogEditions(relationshipId: string): CatalogEditionsApi<CatalogEditionView> {
  const read = useCallback(() => fetchBuyerCatalogEditions(relationshipId), [relationshipId]);
  return useEditionsResource(read);
}
