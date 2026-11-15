'use client';

/**
 * @fileoverview ADR-915 §41.5 — **η διεύθυνση του μητρώου λήξεων**: καρτέλα · προβολή · ομαδοποίηση · ανοιχτό έγγραφο.
 * @related lib/document-validity/document-registry-view.ts (οι αναγνώστες) · hooks/useUrlTabParam.ts (το ιδίωμα) ·
 *   hooks/listings/useListingPhotoParam.ts (επικάλυψη ανοιχτή από παράμετρο)
 * @module hooks/document-registry/useRegistryAddress
 *
 * 🔑 **ΕΝΑΣ μηχανισμός για ΟΛΕΣ τις παραμέτρους** (`url-query-state`). Το `?view=` γραφόταν με
 *    `router.replace(documentExpiryHref(view))`: αυτό **σβήνει κάθε άλλη παράμετρο** (θα έχανε `?tab=`/`?doc=`) και κάνει
 *    γύρο RSC σε κάθε κλικ (ADR-327: 3,5 s). Εδώ κάθε γραφέας αλλάζει **μόνο** το δικό του κλειδί.
 * 🔑 `replace` για κατάσταση θέασης (καρτέλα · προβολή · ομαδοποίηση — ADR-242 Βήμα 3)· **`push`** για το άνοιγμα εγγράφου:
 *    το πάνελ είναι προορισμός, το «Πίσω» το κλείνει (Linear · Gmail). Το κλείσιμο ενός πάνελ που άνοιξε **εδώ** γυρίζει
 *    πίσω στο ιστορικό (καμία διπλή καταχώριση)· ενός που ήρθε από σύνδεσμο αφαιρεί απλώς την παράμετρο.
 * 🔑 Ανάγνωση με `useLiveSearchParams`, όχι `useSearchParams`: το δεύτερο δεν βλέπει το `replaceState` στον dev.
 */

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import { useLiveSearchParams } from '@/hooks/useUrlQuery';
import { pushUrlSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';
import {
  REGISTRY_DEFAULT_GROUPING,
  REGISTRY_DEFAULT_TAB,
  REGISTRY_DOC_PARAM,
  REGISTRY_GROUP_PARAM,
  REGISTRY_TAB_PARAM,
  REGISTRY_VIEW_ALL,
  REGISTRY_VIEW_PARAM,
  registryGroupingOf,
  registryTabOf,
  registryViewOf,
  type RegistryGrouping,
  type RegistryTab,
  type RegistryView,
} from '@/lib/document-validity/document-registry-view';

export interface RegistryAddress {
  readonly tab: RegistryTab;
  readonly view: RegistryView;
  readonly grouping: RegistryGrouping;
  /** Η ωμή τιμή του `?doc=` — τη λύνει το `registryRowOfDocParam` απέναντι στις γραμμές. */
  readonly doc: string | null;
  readonly selectTab: (tab: RegistryTab) => void;
  /** Αλλάζει προβολή **και** δείχνει την καρτέλα «Όλα» (οι κάρτες κατάστασης ζουν πάνω από τις καρτέλες). */
  readonly selectView: (view: RegistryView) => void;
  readonly selectGrouping: (grouping: RegistryGrouping) => void;
  readonly openDoc: (id: string) => void;
  readonly closeDoc: () => void;
}

/**
 * Η καρτέλα στη διεύθυνση. Το φίλτρο `?view=` ζει **μόνο** στην «Όλα»: σε άλλη καρτέλα φεύγει — αλλιώς η διεύθυνση θα
 * έλεγε «Λείπει» ενώ η οθόνη δεν το εφαρμόζει (`?view=missing&tab=action`, βρέθηκε στον browser 2026-11-15).
 * Η προεπιλογή δεν γράφεται: μία διεύθυνση ανά περιεχόμενο.
 */
function writeTab(params: URLSearchParams, tab: RegistryTab): void {
  if (tab !== 'all') params.delete(REGISTRY_VIEW_PARAM);
  if (tab === REGISTRY_DEFAULT_TAB) params.delete(REGISTRY_TAB_PARAM);
  else params.set(REGISTRY_TAB_PARAM, tab);
}

type Writers = Pick<RegistryAddress, 'selectTab' | 'selectView' | 'selectGrouping' | 'openDoc' | 'closeDoc'>;

/** `openedHere`: το πάνελ άνοιξε με `push` **σε αυτή τη σελίδα** ⇒ το κλείσιμο = ένα βήμα πίσω στο ιστορικό. */
function useRegistryWriters(openedHere: MutableRefObject<boolean>): Writers {
  const selectTab = useCallback((tab: RegistryTab) => replaceUrlSearchParams((params) => writeTab(params, tab)), []);
  const selectView = useCallback((view: RegistryView) => replaceUrlSearchParams((params) => {
    if (view === REGISTRY_VIEW_ALL) params.delete(REGISTRY_VIEW_PARAM);
    else params.set(REGISTRY_VIEW_PARAM, view);
    params.set(REGISTRY_TAB_PARAM, 'all');
  }), []);
  const selectGrouping = useCallback((grouping: RegistryGrouping) => replaceUrlSearchParams((params) => {
    if (grouping === REGISTRY_DEFAULT_GROUPING) params.delete(REGISTRY_GROUP_PARAM);
    else params.set(REGISTRY_GROUP_PARAM, grouping);
  }), []);
  const openDoc = useCallback((id: string) => {
    openedHere.current = true;
    pushUrlSearchParams((params) => params.set(REGISTRY_DOC_PARAM, id));
  }, [openedHere]);
  const closeDoc = useCallback(() => {
    if (openedHere.current && typeof window !== 'undefined') {
      openedHere.current = false;
      window.history.back();
      return;
    }
    replaceUrlSearchParams((params) => params.delete(REGISTRY_DOC_PARAM));
  }, [openedHere]);
  return useMemo(
    () => ({ selectTab, selectView, selectGrouping, openDoc, closeDoc }),
    [selectTab, selectView, selectGrouping, openDoc, closeDoc],
  );
}

export function useRegistryAddress(): RegistryAddress {
  const params = useLiveSearchParams();
  const openedHere = useRef(false);
  const writers = useRegistryWriters(openedHere);
  const doc = params.get(REGISTRY_DOC_PARAM);
  // Το «Πίσω» του περιηγητή έκλεισε ήδη το πάνελ ⇒ το επόμενο κλείσιμο ΔΕΝ πρέπει να ξαναγυρίσει πίσω.
  useEffect(() => {
    if (doc === null) openedHere.current = false;
  }, [doc]);
  // Παλιός/χειρόγραφος σύνδεσμος με φίλτρο σε άλλη καρτέλα ⇒ η διεύθυνση θεραπεύεται, ώστε να λέει ό,τι δείχνει η οθόνη.
  const staleView = params.has(REGISTRY_VIEW_PARAM) && registryTabOf(params.get(REGISTRY_TAB_PARAM), params.get(REGISTRY_VIEW_PARAM)) !== 'all';
  useEffect(() => {
    if (staleView) replaceUrlSearchParams((next) => next.delete(REGISTRY_VIEW_PARAM));
  }, [staleView]);
  return useMemo(() => {
    const viewParam = params.get(REGISTRY_VIEW_PARAM);
    return {
      tab: registryTabOf(params.get(REGISTRY_TAB_PARAM), viewParam),
      view: registryViewOf(viewParam),
      grouping: registryGroupingOf(params.get(REGISTRY_GROUP_PARAM)),
      doc,
      ...writers,
    };
  }, [params, doc, writers]);
}
