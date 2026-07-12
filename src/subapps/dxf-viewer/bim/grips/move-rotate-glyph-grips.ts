/**
 * ADR-561 / ADR-627 — whole-entity MOVE-cross + rotation-handle → render-grip SSoT.
 *
 * The interaction path emits the two whole-entity handles (4-arrow MOVE cross +
 * curved ROTATION handle) as plain data grips (`hooks/grip-types.GripInfo`) via the
 * per-entity `getXxxMoveRotateGrips` helpers. Every renderer's `getGrips` then has to
 * turn those into render grips (`rendering/types/Types.GripInfo`) carrying the drawn
 * `shape` from the `gripGlyphShape` registry — an identical map that was copy-pasted
 * into `PolylineRenderer` and `HatchRenderer` (N.18 twin, jscpd CHECK 3.28).
 *
 * This is the ONE place that map lives. Only the entity `on`-tag differs per call
 * site, so it is a generic parameter keyed on the `GripKindByEntity` SSoT — the same
 * discriminator `gripKindOf` reads. Paint ≡ hit-test: the indices/positions come
 * straight from the source grips untouched; only `shape` + `isVisible` are attached.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/grip-glyph-registry.ts — `gripGlyphShape` (glyph SSoT)
 * @see systems/polyline/polyline-grips.ts — `getPolylineMoveRotateGrips`
 * @see bim/hatch/hatch-move-rotate-grips.ts — `getHatchMoveRotateGrips`
 */

import type { GripInfo as DataGripInfo } from '../../hooks/grip-types';
import type { GripInfo as RenderGripInfo } from '../../rendering/types/Types';
import { gripKindOf, type GripKindByEntity } from '../../hooks/grip-kinds';
import { gripGlyphShape } from './grip-glyph-registry';

/**
 * Map the whole-entity move/rotate data grips onto render grips with the correct
 * glyph shape. `on` is the entity-type tag (`'polyline'`, `'hatch'`, …) used to read
 * each grip's `gripKind` discriminator — mistyping it is a compile error against the
 * `GripKindByEntity` SSoT.
 */
export function toMoveRotateGlyphGrips<K extends keyof GripKindByEntity>(
  source: readonly DataGripInfo[],
  on: K,
): RenderGripInfo[] {
  return source.map((g) => ({
    id: `${g.entityId}-grip-${g.gripIndex}`,
    entityId: g.entityId,
    type: g.type,
    gripIndex: g.gripIndex,
    position: g.position,
    isVisible: true,
    shape: gripGlyphShape(gripKindOf(g, on)),
  }));
}
