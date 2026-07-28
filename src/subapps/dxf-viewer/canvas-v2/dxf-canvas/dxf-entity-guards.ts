/**
 * Φύλακες τύπου πάνω στο `DxfEntityUnion` — «είναι όντως γραμμή/διάσταση;»
 * απαντημένο **από τον μεταγλωττιστή**, όχι από χειροκίνητο `if` + cast.
 *
 * ⚠️ Γιατί υπάρχει (μετρημένο 2026-07-28): το μοτίβο
 *
 * ```ts
 * const entity = dxfScene.entities.find(e => e.id === entityId);
 * if (!entity || entity.type !== 'line') return;
 * const line = entity as DxfLine;      // ← ΤΟ ΠΡΟΒΛΗΜΑ
 * ```
 *
 * ήταν γραμμένο **έξι φορές** στις δύο παλέτες ιδιοτήτων. Το cast στην τρίτη
 * γραμμή δεν ελέγχεται από κανέναν: επαναλαμβάνει με το χέρι το συμπέρασμα του
 * `if` από πάνω του, και αν κάποιος αλλάξει τον έλεγχο (`'line'` → `'polyline'`)
 * το cast **δεν το μαθαίνει ποτέ** — απλώς αρχίζει να διαβάζει `start`/`end` από
 * οντότητα που δεν τα έχει.
 *
 * Με φύλακα, το `if` **είναι** η στένωση: δεν υπάρχει δεύτερη δήλωση να αποκλίνει.
 *
 * @module canvas-v2/dxf-canvas/dxf-entity-guards
 */

import type { DxfDimension, DxfEntityUnion, DxfLine } from './dxf-types';

/** True όταν η οντότητα είναι γραμμή (`start`/`end` διαθέσιμα με ασφάλεια). */
export function isDxfLine(entity: DxfEntityUnion): entity is DxfLine {
  return entity.type === 'line';
}

/** True όταν η οντότητα είναι διάσταση (`dimensionEntity` διαθέσιμο με ασφάλεια). */
export function isDxfDimension(entity: DxfEntityUnion): entity is DxfDimension {
  return entity.type === 'dimension';
}
