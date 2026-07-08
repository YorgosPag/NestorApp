/**
 * ADR-559 §multi-select — hide per-object MOVE + ROTATION glyphs on multi-selection.
 *
 * AutoCAD / Revit parity: when MORE THAN ONE object is selected, the per-entity
 * whole-object MOVE (4-arrow) and ROTATION (curved-arrow) handles are suppressed —
 * you move/rotate a multi-selection through a command, not through per-entity glyphs.
 * The structural grips (corners / midpoints / vertices / edges) stay visible AND
 * pickable so a multi-selection can still be reshaped per vertex.
 *
 * This module is the ONE rule, consumed by BOTH grip paths so visible ≡ pickable
 * (the ADR-559 dual-gate invariant — a hidden glyph must not be hit-testable):
 *  - VISIBLE  → `BaseEntityRenderer.renderGrips` (reads `SelectedEntitiesStore.count()`
 *               at frame time, ADR-040 getter, no subscription).
 *  - PICKABLE → `grip-registry.ts useGripRegistry` (reads the selected count directly).
 *
 * Zero React / DOM / store deps — pure predicates, unit-testable in isolation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-559-grip-object-limit.md §multi-select
 * @see bim/grips/grip-glyph-registry.ts — the kind→shape SSoT this delegates to
 */

import type { GripShape } from '../../rendering/grips/types';
import type { GripInfo } from '../grip-types';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';

/**
 * Selection size at/above which per-object transform glyphs are suppressed. `2` =
 * "more than one object selected" (Giorgio 2026-07-01). Distinct from the
 * `gripObjLimit` (ADR-559) which suppresses ALL grips at a much larger count.
 */
export const MULTI_SELECT_HIDE_TRANSFORM_THRESHOLD = 2;

/** True once the selection holds ≥2 objects → per-object MOVE + ROTATION glyphs hide. */
export function hidesPerObjectTransformGlyphs(selectionCount: number): boolean {
  return selectionCount >= MULTI_SELECT_HIDE_TRANSFORM_THRESHOLD;
}

/** True when a resolved glyph shape is a whole-entity MOVE (4-arrow) or ROTATION (curved) handle. */
export function isTransformGlyphShape(shape: GripShape | undefined | null): boolean {
  return shape === 'move' || shape === 'rotation';
}

/**
 * Resolve a data-model grip's glyph shape from whichever parametric kind field it
 * carries (entity-agnostic coalesce → the shared `gripGlyphShape` registry SSoT).
 * The VISIBLE render grips already carry a resolved `shape` (each renderer sets it
 * via `gripGlyphShape`); the registry's data-model grips do NOT, so this gives BOTH
 * paths the SAME move/rotation classification. Only the kinds that can ever be a
 * move/rotation glyph are coalesced — every other kind resolves to `'square'`.
 */
export function dataGripGlyphShape(grip: GripInfo): GripShape {
  // ADR-602 Stage 4 — the entity-agnostic coalesce collapses to the ONE tagged
  // discriminator. `gripGlyphShape` maps any non-move/rotation kind to `'square'`, so
  // widening to all 31 entities is result-equivalent to the previous 17-field chain.
  const kind = grip.gripKind?.kind;
  return gripGlyphShape(kind);
}

/**
 * True when this data-model grip is a MOVE/ROTATION glyph that must hide at the
 * given selection size. Used by the registry (pickable) path where grips carry a
 * kind but no resolved `shape`.
 */
export function shouldHideDataGripForSelection(grip: GripInfo, selectionCount: number): boolean {
  return hidesPerObjectTransformGlyphs(selectionCount) && isTransformGlyphShape(dataGripGlyphShape(grip));
}
