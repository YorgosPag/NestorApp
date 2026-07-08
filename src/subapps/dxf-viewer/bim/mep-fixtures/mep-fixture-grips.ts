/**
 * ADR-406 — MEP fixture (light fixture) parametric 2D grips.
 *
 * The rectangular shape is a PURE centred-box consumer, delegated to the shared box
 * grip SSoT via the `createCentredBoxGripAdapter` factory (ADR-602). On TOP of that
 * the fixture adds a `circular` variant with a single diameter handle — an
 * affordance OUTSIDE a centred rectangle — so it composes the adapter as an
 * ESCAPE-HATCH (No-God-shell): the circular branch is handled locally, the
 * rectangular branch delegates to `adapter.getGrips` / `adapter.applyGripDrag`.
 *
 * Rectangular: 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 * Circular   : 1 → `mep-fixture-diameter` (symmetric 2× resize, centre fixed) — the
 *              only non-box affordance.
 *
 * ADR-363 Φ1G.5 Slice 2 — the central MOVE grip (gripIndex 0) is not emitted on
 * either shape (Alt+drag moves the whole fixture); gripIndex 0 is left unused.
 * `UpdateMepFixtureParamsCommand` recomputes geometry at commit time; this module
 * returns ONLY new `MepFixtureParams`.
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { GripInfo, MepFixtureGripKind } from '../../hooks/grip-types';
import type { MepFixtureEntity, MepFixtureParams } from '../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../types/mep-fixture-types';
import { mmScaleFor } from '../../utils/scene-units';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
  type CentredBoxAdapterDragInput,
} from '../grips/create-centred-box-grip-adapter';

const adapter = createCentredBoxGripAdapter<MepFixtureEntity, MepFixtureParams, MepFixtureGripKind>({
  ...buildCentredBoxKindMaps('mep-fixture'),
  minDimensionMm: MIN_FIXTURE_DIMENSION_MM,
  toBoxParams: (params) => params,
  fromBoxPatch: (original, patch) => ({ ...original, ...patch }),
  toGripInfo: (base, kind) => ({ ...base, mepFixtureGripKind: kind, gripKind: { on: 'mep-fixture', kind } }),
});

/** Drag input for a fixture grip (the shared centred-box 5-field shape). */
export type MepFixtureGripDragInput = CentredBoxAdapterDragInput<MepFixtureParams>;

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
        gripKind: { on: 'mep-fixture', kind: 'mep-fixture-diameter' },
      },
    ];
  }

  // Rectangular: delegate 100% to the shared box SSoT via the adapter.
  return adapter.getGrips(entity);
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

/**
 * Pure transform: MEP fixture grip kind + drag input → new `MepFixtureParams`.
 * The rectangular grips delegate to the shared box SSoT (via the adapter);
 * `mep-fixture-diameter` (circular only) is handled locally. Zero delta / unknown
 * kind → returns `originalParams` referentially unchanged (commit short-circuit).
 */
export function applyMepFixtureGripDrag(
  kind: MepFixtureGripKind,
  input: Readonly<MepFixtureGripDragInput>,
): MepFixtureParams {
  const { originalParams } = input;
  if (input.delta.x === 0 && input.delta.y === 0) return originalParams;
  if (kind === 'mep-fixture-diameter') return resizeDiameter(input);
  // Circular fixtures expose only move + diameter; rotation/corner are never
  // emitted for a circle but guard for safety (pre-SSoT behaviour returned the
  // original params for those on a circular shape).
  if (originalParams.shape === 'circular' && kind !== 'mep-fixture-move') return originalParams;

  return adapter.applyGripDrag(kind, input);
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
