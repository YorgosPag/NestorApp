/**
 * =============================================================================
 * RING EDIT (SSoT) — μετακίνηση, προσθήκη και αφαίρεση κορυφής κλειστού δακτυλίου
 * =============================================================================
 *
 * Οι τρεις πράξεις που κάνει κάθε επεξεργαστής πολυγώνου (Figma · Revit sketch · λαβές BIM): σύρε κορυφή, σπάσε ακμή στο
 * μέσο της, σβήσε κορυφή. Ζούσαν στο `subapps/dxf-viewer/bim/grips/polygon-outline-grip-core.ts` (πλάκες, οροφές, ανοίγματα,
 * δάπεδα) — που τις **καλεί** πλέον από εδώ· ο επεξεργαστής χώρων της περιήγησης (ADR-884 §4.14 Γ3γ-2β) χρειάζεται τις ίδιες
 * και δεν επιτρέπεται να εισάγει από το subapp (CHECK 3.62).
 *
 * 🔑 **Γενικές `<P extends PlanarPoint>`**: ό,τι άλλο κουβαλά μια κορυφή (το `z` του BIM) **μένει** — η μετακίνηση αλλάζει
 *   μόνο `x/y`. Τη νέα κορυφή της προσθήκης τη φτιάχνει ο καλών (το BIM μεσολαβεί `z`, η περιήγηση δεν έχει).
 * 🔑 **`null` = καμία αλλαγή** (δείκτης εκτός ορίων · ίδια θέση · λιγότερες από 3 κορυφές): ο καλών κρατά την **ίδια** αναφορά.
 * 🔑 **Δακτύλιος χωρίς επανάληψη της πρώτης κορυφής** (σύμβαση του `planar-polygon.ts`).
 *
 * @module lib/geometry/ring-edit
 */

import type { PlanarPoint } from './planar-polygon';

/** Το ελάχιστο πλήθος κορυφών κλειστού σχήματος — κάτω από αυτό η αφαίρεση αρνείται. */
export const RING_MIN_VERTICES = 3;

/** Αντίγραφο κορυφής με όλα τα πεδία της (και το `z`). */
function cloneVertex<P extends PlanarPoint>(vertex: P): P {
  return { ...vertex };
}

/** Κορυφή `index` στη θέση `to` (μόνο `x/y`). `null` όταν ο δείκτης λείπει ή η θέση δεν αλλάζει. */
export function moveRingVertex<P extends PlanarPoint>(ring: readonly P[], index: number, to: PlanarPoint): P[] | null {
  const vertex = ring[index];
  if (vertex === undefined) return null;
  if (vertex.x === to.x && vertex.y === to.y) return null;
  return ring.map((v, i) => (i === index ? { ...v, x: to.x, y: to.y } : cloneVertex(v)));
}

/** Νέα κορυφή **μετά** την κορυφή `edgeIndex` (σπάει την ακμή `[edgeIndex, edgeIndex+1]`). `null` όταν η ακμή λείπει. */
export function insertRingVertex<P extends PlanarPoint>(ring: readonly P[], edgeIndex: number, vertex: P): P[] | null {
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= ring.length) return null;
  const next: P[] = [];
  ring.forEach((v, i) => {
    next.push(cloneVertex(v));
    if (i === edgeIndex) next.push(vertex);
  });
  return next;
}

/** Χωρίς την κορυφή `index`. `null` όταν ο δείκτης λείπει ή θα έμεναν λιγότερες από {@link RING_MIN_VERTICES}. */
export function removeRingVertex<P extends PlanarPoint>(ring: readonly P[], index: number): P[] | null {
  if (ring.length <= RING_MIN_VERTICES) return null;
  if (!Number.isInteger(index) || index < 0 || index >= ring.length) return null;
  return ring.filter((_, i) => i !== index);
}

/** Το μέσο της ακμής `[edgeIndex, edgeIndex+1]` — εκεί κάθεται η λαβή «προσθήκη κορυφής». */
export function ringEdgeMidpoint(ring: readonly PlanarPoint[], edgeIndex: number): PlanarPoint {
  const a = ring[edgeIndex];
  const b = ring[(edgeIndex + 1) % ring.length];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
