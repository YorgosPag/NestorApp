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

export interface RegionPerimeterPreview {
  /** Κλειστό πολύγωνο (world units) του ανιχνευμένου περιγράμματος. */
  polygon: Point2D[];
  /** `true` αν ξεπερνά το λογικό δομικό μέλος (Layer 4) → κόκκινο, δεν χτίζεται. */
  oversized: boolean;
  /** Ετικέτα διαστάσεων, π.χ. «2.40 × 0.30 m». */
  label: string;
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
