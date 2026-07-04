/**
 * section-scene-bounds — SSoT για τον υπολογισμό του combined world bbox
 * (BIM group ∪ DXF bounds) που χρησιμοποιεί το section subsystem.
 *
 * Εξήχθη από SectionSceneController (N.0.2 Boy Scout) — το ίδιο union έτρεχε
 * 3× inline (ensureInit + computeSceneBounds εδώ, computeCapSize στον
 * SectionStencilRenderer). Μία πηγή αλήθειας, μηδέν αντιγραφή.
 */

import * as THREE from 'three';
import { finiteBox3FromObject } from './finite-bounds';

/**
 * Επιστρέφει το ένωση-bbox του BIM group με τα DXF bounds, ή `null` αν και τα
 * δύο είναι άδεια. Pure — δεν κρατάει state.
 *
 * ADR-537 — το BIM bbox περνά από το NaN-safe `finiteBox3FromObject` SSoT: μια BIM οντότητα με
 * μη-πεπερασμένη συντεταγμένη δεν μολύνει πλέον το section box (που θα μαύριζε τον καμβά).
 */
export function unionSceneBounds(
  bimGroup: THREE.Object3D,
  dxfBounds: THREE.Box3 | null,
): THREE.Box3 | null {
  const box = new THREE.Box3();
  const bimBox = finiteBox3FromObject(bimGroup);
  if (bimBox) box.union(bimBox);
  if (dxfBounds && !dxfBounds.isEmpty()) box.union(dxfBounds);
  return box.isEmpty() ? null : box;
}
