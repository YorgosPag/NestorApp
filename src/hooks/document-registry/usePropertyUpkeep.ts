'use client';

/**
 * @fileoverview ADR-915 §36 — **η ενότητα «Μόνιμες υποχρεώσεις» ενός ακινήτου**, για την καρτέλα του: φόρτωση μετά την
 *   ταυτότητα, και ανανέωση **στο παρασκήνιο** μετά από απόφαση.
 * @related useDocumentRegistry.ts (το ιδίωμα stale-while-revalidate) · useUpkeepDeclaration.ts (η αποστολή — ΙΔΙΑ) ·
 *   services/document-registry/document-registry.client.ts (`fetchPropertyUpkeep`)
 * @module hooks/document-registry/usePropertyUpkeep
 *
 * 🔑 **Κανένας υπολογισμός**: πρόταση και απόφαση έρχονται έτοιμες από τον διακομιστή (ο ΙΔΙΟΣ `upkeepItemsOf`).
 * 🔑 **Ανανέωση χωρίς «φορτώνει»**: μετά την απόφαση τα στοιχεία μένουν ορατά μέχρι να έρθουν τα νέα (το `reload` του
 *    `useIdentityGatedResource` θα έσβηνε την ενότητα). Η νεότερη απάντηση είναι **δεμένη** στη φόρτωση πάνω στην οποία
 *    ήρθε: αλλαγή ακινήτου ⇒ ποτέ τα στοιχεία του προηγούμενου.
 */

import { useCallback, useState } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import type { UpkeepItem } from '@/lib/document-validity/property-upkeep';
import { fetchPropertyUpkeep, type PropertyUpkeepLoad } from '@/services/document-registry/document-registry.client';

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ καμία ενότητα (η καρτέλα ούτως ή άλλως δεν φαίνεται). */
const NOBODY: PropertyUpkeepLoad = { kind: 'unavailable' };

export type PropertyUpkeepView =
  | { readonly state: 'loading' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly items: readonly UpkeepItem[] };

export interface PropertyUpkeepApi {
  readonly view: PropertyUpkeepView;
  /** Ξαναδιάβασμα στο παρασκήνιο — το δίνει η σελίδα στο `useUpkeepDeclaration`. */
  readonly revalidate: () => Promise<void>;
}

interface Fresher {
  readonly base: PropertyUpkeepLoad;
  readonly items: readonly UpkeepItem[];
}

function viewOf(loaded: PropertyUpkeepLoad | null, fresher: Fresher | null): PropertyUpkeepView {
  if (loaded === null) return { state: 'loading' };
  if (loaded.kind !== 'ready') return { state: loaded.kind };
  return { state: 'ready', items: fresher !== null && fresher.base === loaded ? fresher.items : loaded.items };
}

export function usePropertyUpkeep(propertyId: string): PropertyUpkeepApi {
  const fetcher = useCallback(() => fetchPropertyUpkeep(propertyId), [propertyId]);
  const { value: loaded } = useIdentityGatedResource<PropertyUpkeepLoad>(fetcher, NOBODY);
  const [fresher, setFresher] = useState<Fresher | null>(null);

  const revalidate = useCallback(async (): Promise<void> => {
    if (loaded === null || loaded.kind !== 'ready') return;
    const next = await fetcher();
    // Αποτυχημένη ανανέωση ⇒ κρατά τα προηγούμενα (ποτέ κενή ενότητα από βλάβη δικτύου).
    if (next.kind === 'ready') setFresher({ base: loaded, items: next.items });
  }, [fetcher, loaded]);

  return { view: viewOf(loaded, fresher), revalidate };
}
