/**
 * @fileoverview **ΠΟΣΟ ΜΕΓΕΘΥΜΕΝΗ ΕΙΝΑΙ ΚΑΘΕ ΚΑΤΟΨΗ** — η θέαση ανά όροφο, εκτός React (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 5).
 * @related `lib/state/createExternalStore.ts` (το ΕΝΑ primitive) · `lib/spatial-tour/viewer/tour-plan-zoom.ts` (τα μαθηματικά) ·
 *   `TourPlanMap.tsx` · `TourPlanZoomBar.tsx` · `usePlanZoomGestures.ts`
 * @module components/spatial-tour/viewer/tour-plan-zoom-store
 *
 * 🔑 **ΕΝΑΣ κάτοχος για κάρτα ΚΑΙ ανάπτυξη** (↗): ό,τι μεγέθυνες στη στήλη το βρίσκεις στην πλήρη οθόνη και αντίστροφα.
 *   Σκόπιμη απόκλιση από το `FloorplanGallery` (ADR-187), που κρατά **δύο** ανεξάρτητα `useZoomPan` — εκεί το κλείσιμο
 *   του παραθύρου πετάει ό,τι είχε δει ο χρήστης.
 * 🔑 **Ανά όροφο**: κάθε κάρτα έχει το δικό της «− ●—— +» (Zillow). Κλειδί = `levelId`.
 * 🔑 **Δεν αποθηκεύεται** μεταξύ επισκέψεων: η μεγέθυνση είναι στιγμή της περιήγησης, όχι προτίμηση (Zillow · Matterport
 *   ανοίγουν πάντα την κάτοψη ολόκληρη). Αποθηκεύεται μόνο το πλάτος της στήλης (`tour-viewer-layout-store.ts`).
 */

import { useCallback, useSyncExternalStore } from 'react';

import { createExternalStore, type ExternalStore } from '@/lib/state/createExternalStore';
import { PLAN_VIEW_FIT, type PlanView } from '@/lib/spatial-tour/viewer/tour-plan-zoom';

export type TourPlanZoomStore = ExternalStore<ReadonlyMap<string, PlanView>>;

export function createTourPlanZoomStore(): TourPlanZoomStore {
  return createExternalStore<ReadonlyMap<string, PlanView>>(new Map(), { equals: Object.is });
}

/** Η θέαση ενός ορόφου — σταθερή αναφορά όσο δεν αλλάζει (ασφαλές για `useSyncExternalStore`). */
export function getPlanView(store: TourPlanZoomStore, levelId: string): PlanView {
  return store.get().get(levelId) ?? PLAN_VIEW_FIT;
}

export function setPlanView(store: TourPlanZoomStore, levelId: string, view: PlanView): void {
  if (getPlanView(store, levelId) === view) return;
  const next = new Map(store.get());
  next.set(levelId, view);
  store.set(next);
}

/** Συνδρομή σε **έναν** όροφο: οι άλλες κάρτες δεν ξαναζωγραφίζονται όταν μεγεθύνεις αυτήν. */
export function usePlanView(store: TourPlanZoomStore, levelId: string): PlanView {
  const read = useCallback(() => getPlanView(store, levelId), [store, levelId]);
  return useSyncExternalStore(store.subscribe, read, read);
}
