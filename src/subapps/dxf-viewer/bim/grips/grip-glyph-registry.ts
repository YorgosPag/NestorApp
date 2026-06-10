/**
 * ADR-397 — BIM grip glyph shape registry (FULL SSoT).
 *
 * Single source of truth mapping a parametric grip KIND (any BIM entity) to its
 * rendered glyph shape. Before ADR-397 each entity owned its own
 * `xxxGripGlyphShape()` switch (`wallGripGlyphShape`, `stairGripGlyphShape`) and
 * the column had none — so columns rendered plain squares. This registry
 * collapses every per-entity mapping into ONE table, consumed by all entity
 * renderers via {@link gripGlyphShape}.
 *
 * The drawing primitives themselves (`renderMoveGlyph` 4-arrow / `renderRotationGlyph`
 * curved-arrow) live in `rendering/grips/GripShapeRenderer.ts` and are unchanged —
 * this module only decides WHICH shape a given grip kind paints.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md §3 D1
 * @see rendering/grips/GripShapeRenderer.ts — renderMoveGlyph / renderRotationGlyph
 */

import type { GripShape } from '../../rendering/grips/types';

/**
 * The single registry of move/rotation glyph grip kinds across ALL BIM entities.
 * Any kind absent here renders the default `'square'` shape. Keep additions here
 * — never re-introduce a per-entity glyph switch (that is the duplication this
 * registry exists to prevent).
 *
 *  - `'move'`     → 4-way arrow (whole-entity translate handle)
 *  - `'rotation'` → curved arrow (rotate handle)
 */
export const GRIP_GLYPH_REGISTRY: Readonly<Record<string, GripShape>> = {
  // Walls (ADR-363 Phase 1C-ter)
  'wall-midpoint': 'move',
  'wall-rotation': 'rotation',
  // Beams (ADR-363 Phase 5.5d) — axis-based move + rotation (wall parity).
  'beam-midpoint': 'move',
  'beam-rotation': 'rotation',
  // Stairs (ADR-393 v2)
  'stair-base': 'move',
  'stair-direction': 'rotation',
  // Columns (ADR-397)
  'column-center': 'move',
  'column-rotation': 'rotation',
  // Foundations (ADR-436 Slice 1b) — pad: rotation = ROTATION glyph; center MOVE
  // (Alt+drag, not emitted as a grip). width/length render the default 'square'.
  'foundation-center': 'move',
  'foundation-rotation': 'rotation',
  // MEP fixtures (ADR-406) — corners render the default 'square' glyph.
  'mep-fixture-move': 'move',
  'mep-fixture-rotation': 'rotation',
  // Electrical panels (ADR-408 Φ3) — corners render the default 'square' glyph.
  'electrical-panel-move': 'move',
  'electrical-panel-rotation': 'rotation',
  // MEP manifolds (ADR-408 Φ12) — corners render the default 'square' glyph;
  // the outlet add/remove action grips render the Revit "array control" ▲/▼.
  'mep-manifold-move': 'move',
  'mep-manifold-rotation': 'rotation',
  'mep-manifold-outlet-add': 'triangle-up',
  'mep-manifold-outlet-remove': 'triangle-down',
  // Heating radiators (ADR-408 Εύρος Β) — corners render the default 'square' glyph.
  'mep-radiator-move': 'move',
  'mep-radiator-rotation': 'rotation',
  // Heating boilers (ADR-408 Εύρος Β #2) — corners render the default 'square' glyph.
  'mep-boiler-move': 'move',
  'mep-boiler-rotation': 'rotation',
  // Domestic hot water heaters (ADR-408 DHW) — corners render the default 'square' glyph.
  'mep-water-heater-move': 'move',
  'mep-water-heater-rotation': 'rotation',
  // MEP segments (ADR-408 Φ8) — start/end/section render 'square'; midpoint = MOVE,
  // rotation = ROTATION (full beam parity for the linear-element vocabulary).
  'mep-segment-midpoint': 'move',
  'mep-segment-rotation': 'rotation',
  // Furniture (ADR-410) — corners render the default 'square' glyph.
  'furniture-move': 'move',
  'furniture-rotation': 'rotation',
  // Floorplan symbols (ADR-415) — corners render the default 'square' glyph.
  'floorplan-symbol-move': 'move',
  'floorplan-symbol-rotation': 'rotation',
  // Openings (ADR-363 Phase 2.5 + facing-flip — wall-hosted door/window):
  // move MOVE glyph· rotation = Flip Hand· facing = Flip Facing (both ROTATION glyph,
  // distinguished by position — rotation is on the swing side, facing on the opposite).
  // 4 corners render 'square'.
  'opening-move': 'move',
  'opening-rotation': 'rotation',
  'opening-facing': 'rotation',
} as const;

/**
 * Map any parametric grip kind to its rendered glyph shape. Registry lookup with
 * `'square'` default. Accepts a plain string so every entity (wall / stair /
 * column / future beam / slab) calls the SAME function — no per-entity switch.
 */
export function gripGlyphShape(kind: string | undefined | null): GripShape {
  if (kind == null) return 'square';
  return GRIP_GLYPH_REGISTRY[kind] ?? 'square';
}
