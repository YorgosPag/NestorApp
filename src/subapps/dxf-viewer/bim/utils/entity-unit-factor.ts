/**
 * entity-unit-factor.ts — SSoT for the mm → entity-native-canvas-unit scale factor.
 *
 * ADR-049 Phase 2 (re-home) — extracted out of `bim-3d/utils/bim3d-edit-math.ts`
 * (which transitively imports `three`) so it lives in a NEUTRAL location that the
 * pure command/geometry path (`MoveEntityCommand` → `bim-move-geometry` →
 * `bim-vertical-move`) can import WITHOUT dragging Three.js into the command layer.
 * `bim3d-edit-math.ts` re-exports this for back-compat — the ~10 existing callers
 * stay byte-for-byte unchanged.
 *
 * Most BIM types store params in raw mm → factor 1. The exceptions carry an
 * inferred / explicit `sceneUnits` (meter scenes, stairs) and must scale a mm
 * delta into their drawing units, otherwise a non-mm drawing flings the element
 * 1000× off-screen before the resync snaps it back (the documented "vanish" bug).
 *
 * Pure — no React, no Three.js, no scene reads.
 */

import type { Entity } from '../../types/entities';
import { mmToSceneUnits, mmScaleFor, inferSceneUnitsFromWidth } from '../../utils/scene-units';

/**
 * The factor that converts a millimetre delta into `entity`'s native canvas units
 * (1 for an mm drawing, 0.001 for a meter scene, the width-inferred factor for a
 * stair). Mirror used by the gizmo move/rotate, the grip commits, and the
 * polymorphic move geometry SSoT so every path relocates an element by the same
 * distance.
 */
export function mmToEntityUnitFactor(entity: Entity): number {
  if (entity.type === 'stair') {
    return mmToSceneUnits(inferSceneUnitsFromWidth(entity.params.width));
  }
  if (
    entity.type === 'wall' ||
    entity.type === 'column' ||
    entity.type === 'beam' ||
    entity.type === 'slab' ||
    // ADR-406 / ADR-408 Φ3 — point-based MEP hosts also carry `params.sceneUnits`;
    // without this their meter-scene gizmo move delta is 1000× off (entity flies
    // away then snaps back on resync). Same fix as the structural types above.
    entity.type === 'mep-fixture' ||
    entity.type === 'electrical-panel' ||
    // ADR-408 Φ12 — plumbing manifold also carries `params.sceneUnits`.
    entity.type === 'mep-manifold' ||
    // ADR-410 — furniture also carries `params.sceneUnits` (same pattern).
    entity.type === 'furniture' ||
    // ADR-408 Φ8 — linear MEP segment carries `params.sceneUnits` too.
    entity.type === 'mep-segment'
  ) {
    return mmScaleFor(entity.params);
  }
  return 1;
}
