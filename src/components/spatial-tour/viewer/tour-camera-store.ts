/**
 * @fileoverview **ΠΟΥ ΚΟΙΤΑΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ ΤΩΡΑ** — η θέαση ως εξωτερικό store, εκτός React (ADR-884 Φ1 · §4.8).
 * @related `lib/state/createExternalStore.ts` (το ΕΝΑ primitive) · `TourPlanCone.tsx` (ο μόνος React συνδρομητής)
 * @module components/spatial-tour/viewer/tour-camera-store
 *
 * 🔑 **Πνεύμα ADR-040**: η θέαση αλλάζει σε κάθε καρέ συρσίματος. Αν ζούσε σε `useState` του θεατή, όλος ο θεατής
 * (κάτοψη · όροφοι · κουμπιά) θα ξαναζωγραφιζόταν 60 φορές το δευτερόλεπτο. Εδώ η μηχανή τη διαβάζει με συνδρομή
 * (imperative) και **μόνο** ο κώνος του mini-map είναι React συνδρομητής — φύλλο που ζωγραφίζει ένα `<path>`.
 */

import { createExternalStore, type ExternalStore } from '@/lib/state/createExternalStore';
import { clampView, initialView, type TourView } from '@/lib/spatial-tour/viewer/tour-viewer-view';

export interface TourCameraState {
  readonly view: TourView;
  /** Πλάτος/ύψος του καμβά — για το άνοιγμα του κώνου. */
  readonly aspect: number;
}

export type TourCameraStore = ExternalStore<TourCameraState>;

export function createTourCameraStore(): TourCameraStore {
  return createExternalStore<TourCameraState>({ view: initialView(), aspect: 16 / 9 }, { equals: Object.is });
}

/** Κάθε αλλαγή θέασης περνά από τα όρια — κανείς δεν γράφει θέαση εκτός ορίων στο store. */
export function setCameraView(store: TourCameraStore, view: TourView): void {
  store.set({ ...store.get(), view: clampView(view) });
}
