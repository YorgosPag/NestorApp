/**
 * roof-world-transform — ADR-417. SSoT μετατροπή roof-coords → Three.js world.
 *
 * Εξάγεται σε ξεχωριστό module ώστε να το μοιράζονται ΟΛΟΙ οι roof 3D builders
 * (`roof-to-three.ts`, `roof-ridge-cap.ts`, μελλοντικά το γείσο) χωρίς circular
 * import / duplication (N.0.2 / N.12).
 *
 * **UNITS-SAFE** (pattern από `railing-to-three.ts`):
 *   - canvas-unit XY  → μέτρα via `sceneToM` (= `sceneUnitsToMeters(units)`)
 *   - mm Z            → μέτρα via `MM_TO_M`
 *
 * Axis convention (ίδιο με BimToThreeConverter / railing):
 *   DXF plan: X = East, Y = North → Three.js world (Y-up, m): x = East, y = Up,
 *   z = −North.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import * as THREE from 'three';

/** mm → meters. */
export const MM_TO_M = 0.001;

/** canvas-unit XY + mm Z → Three.js world position (m, Y-up, z = −North). */
export function toWorld(
  x: number,
  y: number,
  zMm: number,
  sceneToM: number,
): THREE.Vector3 {
  return new THREE.Vector3(x * sceneToM, zMm * MM_TO_M, -y * sceneToM);
}
