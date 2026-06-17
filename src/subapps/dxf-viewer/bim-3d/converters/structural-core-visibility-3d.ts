/**
 * ADR-469 — 3Δ core (σώμα σκυροδέματος) visibility helper SSoT.
 *
 * Όταν το `core` component ενός δομικού στοιχείου είναι κρυμμένο (per-view ή
 * per-element override), κρύβουμε ΜΟΝΟ το core mesh (`visible = false`) και
 * αφήνουμε τον σοβά + τον οπλισμό ορατά — ώστε «μόνο οπλισμός» / «μόνο σοβάς»
 * να αποδίδεται σωστά στο 3Δ (mirror του 2Δ early-return στους leaf renderers).
 *
 * Το core mesh ΠΑΡΑΜΕΝΕΙ στο scene graph (κρατά το bimId/bimType tag) ώστε η
 * επιλογή/υπολογισμοί να μη σπάσουν — απλώς δεν αποδίδεται. Κοινό σημείο για
 * column/beam/slab/foundation/wall converters (μηδέν διπλότυπο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-469-structural-component-visibility.md
 */

import type { Object3D } from 'three';
import {
  isStructuralComponentVisible,
  type ComponentVisibilityEntity,
} from '../../bim/visibility/structural-component-visibility';

/**
 * Κρύβει το `coreMesh` αν το `core` component είναι ανενεργό για το `entity`,
 * επιστρέφοντας το `result` (composite group ή σκέτο mesh) αμετάβλητο αλλιώς.
 */
export function applyStructuralCoreVisibility3D<T extends Object3D>(
  result: T,
  coreMesh: Object3D,
  entity: ComponentVisibilityEntity,
): T {
  if (!isStructuralComponentVisible('core', entity)) coreMesh.visible = false;
  return result;
}
