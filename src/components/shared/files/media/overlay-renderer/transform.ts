/**
 * Overlay renderer — coordinate transform (Y-UP CAD convention).
 *
 * **Thin re-export shim.** The fit + world↔screen math was promoted to the
 * neutral SSoT `@/lib/dxf-scene/scene-fit-transform` so the surfaces that live
 * outside `components/` — the upload thumbnail generator (`services/`), the BIM
 * read-only transform bridge, the project floorplan tab — share the exact same
 * pixels instead of each re-inlining the formulas (they all did).
 *
 * This module stays as the overlay renderer's import surface, so its consumers
 * (`floorplan-overlay-system`, `floorplan-pdf-overlay-renderer`,
 * `MeasureToolOverlay`, the `overlay-renderer` barrel) need no churn.
 *
 * @module components/shared/files/media/overlay-renderer/transform
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

export {
  computeFitTransform,
  rectBoundsToScene,
  worldToScreen,
  screenToWorld,
  projectX,
  projectY,
} from '@/lib/dxf-scene/scene-fit-transform';
