/**
 * ADR-419 Layer 5b — module-level pub/sub store για τα «gap markers» (κόκκινοι
 * κύκλοι στα ανοιχτά άκρα) όταν ένα region/perimeter pick ΔΕΝ κλείνει βρόχο.
 *
 * AutoCAD `BOUNDARY` red-circles feedback: δείχνει ΠΟΥ είναι το κενό ώστε ο χρήστης
 * να ενώσει τα άκρα και να ξαναδοκιμάσει. Αδελφό store του `RegionPerimeterPreview`
 * (πράσινη διακεκομμένη preview)· ίδιο zero-React pattern (ADR-040) — ο overlay leaf
 * είναι ο μόνος subscriber.
 *
 * Lifecycle: γεμίζει σε αποτυχημένο κλικ (no-closed-loop), αδειάζει στην αρχή του
 * επόμενου κλικ (επιτυχές = καθαρό) και στο tool deactivate. ΔΕΝ καθαρίζεται στο
 * mousemove (τα markers μένουν μέχρι ο χρήστης να δράσει, σαν AutoCAD).
 *
 * @see ../../components/dxf-layout/RegionGapMarkersOverlay.tsx (renderer)
 * @see ../../bim/walls/perimeter-from-faces.ts (findOpenChainEndpointsNear — producer)
 * @see ./RegionPerimeterPreviewStore.ts (sibling — valid-perimeter preview)
 */

import type { Point2D } from '../../rendering/types/Types';

let state: readonly Point2D[] = [];
const listeners = new Set<() => void>();

export function setRegionGapMarkers(next: readonly Point2D[]): void {
  state = next;
  listeners.forEach((fn) => fn());
}

export function getRegionGapMarkers(): readonly Point2D[] {
  return state;
}

export function subscribeRegionGapMarkers(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearRegionGapMarkers(): void {
  if (state.length === 0) return;
  setRegionGapMarkers([]);
}
