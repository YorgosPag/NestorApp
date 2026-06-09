/**
 * ADR-406 — MEP fixture (light fixture) parametric 2D grips.
 *
 * Thin adapter over the shared **centred rotatable-box** grip SSoT
 * (`bim/grips/centred-box-grips.ts`) for the rectangular shape, PLUS a small
 * fixture-specific `circular` extension (single diameter handle) that has no box
 * equivalent. The rectangular path delegates 100% to the SSoT and only maps the
 * entity-agnostic grip ROLES (`'move'` / `'rotation'` / `'corner-*'`) to/from the
 * fixture grip-kind strings (`'mep-fixture-move'`, …).
 *
 * Rectangular (5 grips): 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 * Circular   (1 grip):   1 → `mep-fixture-diameter` (symmetric 2× resize,
 *                        centre fixed) — the only non-box affordance.
 *
 * ADR-363 Φ1G.5 Slice 2 — the central MOVE grip (gripIndex 0) is no longer
 * emitted on either shape (Alt+drag moves the whole fixture); gripIndex 0 is
 * left unused (no reindex).
 *
 * SSoT: all box geometry + rotation math live in the shared box SSoT + `grip-math`
 * (ADR-188 canonical `rotatePoint`) — NO re-implemented cos/sin here.
 * `UpdateMepFixtureParamsCommand` recomputes geometry at commit time; this module
 * returns ONLY new `MepFixtureParams`.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box SSoT (consumed by the panel too)
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepFixtureGripKind } from '../../hooks/grip-types';
import type { MepFixtureEntity, MepFixtureParams } from '../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../types/mep-fixture-types';
import { mmScaleFor } from '../../utils/scene-units';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
} from '../grips/centred-box-grips';

// ─── Role ↔ fixture-kind maps (rectangular grips) ─────────────────────────────

const ROLE_TO_KIND: Readonly<Record<CentredBoxGripRole, MepFixtureGripKind>> = {
  'move': 'mep-fixture-move',
  'rotation': 'mep-fixture-rotation',
  'corner-ne': 'mep-fixture-corner-ne',
  'corner-nw': 'mep-fixture-corner-nw',
  'corner-sw': 'mep-fixture-corner-sw',
  'corner-se': 'mep-fixture-corner-se',
};
const KIND_TO_ROLE: Readonly<Partial<Record<MepFixtureGripKind, CentredBoxGripRole>>> = {
  'mep-fixture-move': 'move',
  'mep-fixture-rotation': 'rotation',
  'mep-fixture-corner-ne': 'corner-ne',
  'mep-fixture-corner-nw': 'corner-nw',
  'mep-fixture-corner-sw': 'corner-sw',
  'mep-fixture-corner-se': 'corner-se',
};

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepFixtureEntity`. Stable order:
 *   rectangular (5 grips): 1 → rotation, 2-5 → corners (ne, nw, sw, se)
 *   circular   (1 grip):   1 → diameter
 * ADR-363 Φ1G.5 Slice 2 — the central MOVE grip (gripIndex 0) is suppressed on
 * both shapes; the entity is moved via Alt+drag from any remaining grip.
 */
export function getMepFixtureGrips(entity: Readonly<MepFixtureEntity>): GripInfo[] {
  const { params } = entity;

  if (params.shape === 'circular') {
    // Fixture-specific: a circle has no rotation / corners — only the single
    // diameter handle on the world +X radius (rotation ignored, mirror column).
    // The move grip is dropped (Slice 2); gripIndex 1 kept stable (no reindex).
    const s = mmScaleFor(params);
    return [
      {
        entityId: entity.id,
        gripIndex: 1,
        type: 'vertex',
        position: { x: params.position.x + (params.width / 2) * s, y: params.position.y },
        movesEntity: false,
        mepFixtureGripKind: 'mep-fixture-diameter',
      },
    ];
  }

  // Rectangular: delegate 100% to the shared box SSoT, map roles → fixture kinds.
  return getCentredBoxGrips(params).map((g) => ({
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    movesEntity: g.movesEntity,
    mepFixtureGripKind: ROLE_TO_KIND[g.role],
  }));
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepFixtureGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepFixtureParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** ORTHO (F8) active → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
  /**
   * Rotation centre for the `mep-fixture-rotation` 6-click hot-grip
   * (AutoCAD ROTATE→Reference). With `currentPos`, the fixture orbits this centre.
   */
  readonly pivot?: Point2D;
  /** World cursor position (= grip anchor + `delta`). Pivot-rotate path only. */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: MEP fixture grip kind + drag input → new `MepFixtureParams`.
 * The rectangular grips delegate to the shared box SSoT; `mep-fixture-diameter`
 * (circular only) is handled locally. Zero delta / unknown kind → returns
 * `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepFixtureGripDrag(
  kind: MepFixtureGripKind,
  input: Readonly<MepFixtureGripDragInput>,
): MepFixtureParams {
  const { originalParams } = input;
  if (input.delta.x === 0 && input.delta.y === 0) return originalParams;
  if (kind === 'mep-fixture-diameter') return resizeDiameter(input);

  const role = KIND_TO_ROLE[kind];
  if (!role) return originalParams;
  // Circular fixtures expose only move + diameter; rotation/corner are never
  // emitted for a circle but guard for safety (pre-SSoT behaviour returned the
  // original params for those on a circular shape).
  if (originalParams.shape === 'circular' && role !== 'move') return originalParams;

  const patch = applyCentredBoxGripDrag(role, {
    originalParams,
    delta: input.delta,
    minDimensionMm: MIN_FIXTURE_DIMENSION_MM,
    ortho: input.ortho,
    ...(input.pivot ? { pivot: input.pivot } : {}),
    ...(input.currentPos ? { currentPos: input.currentPos } : {}),
  });
  if (!patch) return originalParams;
  return { ...originalParams, ...patch };
}

/**
 * Fixture-specific circular resize: the diameter handle sits on world +X;
 * symmetric 2× resize about the fixed centre (mirror column circular width).
 * Convert scene-unit delta back to mm (÷ s). No box equivalent.
 */
function resizeDiameter(input: Readonly<MepFixtureGripDragInput>): MepFixtureParams {
  const { originalParams, delta } = input;
  const s = mmScaleFor(originalParams);
  const newWidth = Math.max(MIN_FIXTURE_DIMENSION_MM, originalParams.width + (2 * delta.x) / s);
  return { ...originalParams, width: newWidth };
}
