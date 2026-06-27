/**
 * placement-overlay-project — PURE scene-unit → canvas-px projector για το 3D placement overlay
 * (ADR-544). Είναι ο 3D `OverlayProjector` που τρέφει τους ΙΔΙΟΥΣ 2D placement painters
 * (`paintPolarDisk`/`paintRectGrid`/`paintGhostFaceDimensions`/`paintAlignmentGuide`).
 *
 * Δύο γέφυρες, ΜΗΔΕΝ νέα γεωμετρία — reuse του `makeGripPlanToCanvas` (ADR-535 Φ5, η ΜΙΑ
 * projection SSoT plan-mm→px μέσω κάμερας) + του unit factor SSoT (`mmToSceneUnits`):
 *
 *   1. **scene → plan-mm:** το 2D meta είναι σε scene units (όπως το παράγει το
 *      `generateColumnPreview`)· διαιρούμε με `mmToSceneUnits(units)` → plan-mm (η native γλώσσα
 *      του `dxfPlanToWorld`). Inverse του `planMmToScenePoint` — μηδέν re-multiply bug.
 *   2. **plan-mm → canvas-px:** ο grip projector ανεβάζει το σημείο στη στάθμη `elevMm`, το προβάλλει
 *      μέσω της live κάμερας και επιστρέφει canvas-local px (ή `GRIP_OFFSCREEN` πίσω από την κάμερα).
 *
 * Pure Three.js + οι coordinate SSoTs — no React/store/scene mutation. Jest-friendly.
 *
 * @see ../grips/grip-3d-screen-project.ts — makeGripPlanToCanvas (plan-mm→px SSoT)
 * @see ./world-to-scene-point.ts — planMmToScenePoint (η αντίστροφη μετατροπή)
 */

import type * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { OverlayProjector } from '../../canvas-v2/preview-canvas/overlay-projector';
import { makeGripPlanToCanvas } from '../grips/grip-3d-screen-project';
import type { SceneUnits } from '../../utils/scene-units';
// SSoT συντεταγμένων: scene-unit → plan-mm ζει δίπλα στο forward sibling planMmToScenePoint.
import { scenePointToPlanMm } from './world-to-scene-point';

/**
 * Χτίσε τον scene→canvas-px projector για τη δοθείσα κάμερα + overlay canvas, στη στάθμη `elevMm`.
 * Το επιστρεφόμενο closure είναι ο `OverlayProjector` που καλούν οι 2D painters.
 */
export function makePlacementOverlayProjector(
  camera: THREE.Camera,
  canvas: HTMLElement,
  units: SceneUnits,
  elevMm: number,
): OverlayProjector {
  const planProject = makeGripPlanToCanvas(camera, canvas, () => elevMm);
  return (pScene: Point2D) => planProject(scenePointToPlanMm(pScene, units));
}
