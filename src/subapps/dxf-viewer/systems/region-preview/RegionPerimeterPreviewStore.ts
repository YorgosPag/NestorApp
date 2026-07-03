/**
 * ADR-419 Layer 3 — module-level pub/sub store για το hover preview του
 * ανιχνευμένου περιγράμματος στα εργαλεία «σε περιοχή / από περίγραμμα» (κολώνες +
 * τοίχοι). Ίδιο pattern με `AutoAreaPreviewStore` / `HoverStore` (ADR-040).
 *
 * Revit «Finish Sketch» feedback: πριν το κλικ, ο χρήστης βλέπει το boundary που θα
 * δημιουργηθεί + τις διαστάσεις του· κόκκινο αν είναι πολύ μεγάλο (εξωτερικό
 * περίγραμμα του σχεδίου → δεν θα δημιουργηθεί).
 *
 * @see ../../components/dxf-layout/RegionPerimeterPreviewOverlay.tsx (renderer)
 * @see ../../hooks/canvas/useRegionPerimeterMouseMove.ts (producer)
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * ADR-419 §thickness-zones — μία ΖΩΝΗ σταθερού πάχους του ανιχνευμένου περιγράμματος.
 * Ένα ενιαίο ορθογώνιο = 1 ζώνη· ένα σύνθετο (rectilinear) περίγραμμα σπάει σε N ζώνες
 * (ένας τοίχος ανά ζώνη) → η preview δείχνει το ΙΔΙΟ split με το commit (preview ≡ commit).
 */
export interface RegionPerimeterZone {
  /** Κλειστό πολύγωνο (world units) της ζώνης. */
  polygon: Point2D[];
  /** Ετικέτα διαστάσεων της ζώνης, π.χ. «2.40 × 0.30 m». */
  label: string;
}

export interface RegionPerimeterPreview {
  /** Μία ή περισσότερες ζώνες σταθερού πάχους (ένας τοίχος ανά ζώνη). */
  zones: RegionPerimeterZone[];
  /** `true` αν ξεπερνά το λογικό δομικό μέλος (Layer 4) → κόκκινο, δεν χτίζεται. */
  oversized: boolean;
}

let state: RegionPerimeterPreview | null = null;
const listeners = new Set<() => void>();

export function setRegionPerimeterPreview(next: RegionPerimeterPreview | null): void {
  state = next;
  listeners.forEach((fn) => fn());
}

export function getRegionPerimeterPreview(): RegionPerimeterPreview | null {
  return state;
}

export function subscribeRegionPerimeterPreview(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearRegionPerimeterPreview(): void {
  setRegionPerimeterPreview(null);
}
