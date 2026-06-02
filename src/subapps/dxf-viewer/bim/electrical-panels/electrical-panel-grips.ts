/**
 * ADR-408 Φ3 — Electrical panel parametric 2D grips (wall-parity).
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`). A panel is **always rectangular** (no
 * circular / diameter handle), so it delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * panel-specific grip-kind strings (`'electrical-panel-move'`, …) that the
 * discriminator unions + glyph / hot-grip / commit registries expect.
 *
 * Exposes (6 grips, stable order):
 *   0 → `electrical-panel-move`     (centre, MOVE glyph)
 *   1 → `electrical-panel-rotation` (handle beyond +Y edge, ROTATION glyph)
 *   2-5 → `electrical-panel-corner-{ne,nw,sw,se}` (opposite-corner-anchored resize,
 *         ORTHO-aware). Clamped to `MIN_PANEL_DIMENSION_MM`.
 *
 * SSoT: geometry math lives in the shared box SSoT + `grip-math`
 * (`rotateVector` / `projectToLocalFrame` / `sweptAngleDegAboutPivot` + canonical
 * `rotatePoint`, ADR-188) — NO re-implemented cos/sin. `UpdateElectricalPanelParamsCommand`
 * recomputes geometry at commit time; this module returns ONLY new params.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT (consumed by the fixture too)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ElectricalPanelGripKind } from '../../hooks/grip-types';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../types/electrical-panel-types';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// ─── Role ↔ panel-kind maps ───────────────────────────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, ElectricalPanelGripKind>> = {
  'move': 'electrical-panel-move',
  'rotation': 'electrical-panel-rotation',
  'corner-ne': 'electrical-panel-corner-ne',
  'corner-nw': 'electrical-panel-corner-nw',
  'corner-sw': 'electrical-panel-corner-sw',
  'corner-se': 'electrical-panel-corner-se',
};
const KIND_TO_ROLE: Readonly<Record<ElectricalPanelGripKind, CentredBoxGripRole>> = {
  'electrical-panel-move': 'move',
  'electrical-panel-rotation': 'rotation',
  'electrical-panel-corner-ne': 'corner-ne',
  'electrical-panel-corner-nw': 'corner-nw',
  'electrical-panel-corner-sw': 'corner-sw',
  'electrical-panel-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for an `ElectricalPanelEntity` (6 grips,
 * stable order: move, rotation, 4 corners). Delegates to the shared box SSoT.
 */
export function getElectricalPanelGrips(entity: Readonly<ElectricalPanelEntity>): GripInfo[] {
  return getCentredBoxGrips(entity.params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    electricalPanelGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface ElectricalPanelGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: ElectricalPanelParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** ORTHO (F8) active → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
  /**
   * Rotation centre for the `electrical-panel-rotation` 6-click hot-grip
   * (AutoCAD ROTATE→Reference). With `currentPos`, the panel orbits this centre.
   */
  readonly pivot?: Point2D;
  /** World cursor position (= grip anchor + `delta`). Pivot-rotate path only. */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: electrical panel grip kind + drag input → new
 * `ElectricalPanelParams`. Delegates to the shared box SSoT; zero delta / unknown
 * kind → returns `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyElectricalPanelGripDrag(
  kind: ElectricalPanelGripKind,
  input: Readonly<ElectricalPanelGripDragInput>,
): ElectricalPanelParams {
  const { originalParams } = input;
  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_PANEL_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}
