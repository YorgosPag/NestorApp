/**
 * ADR-615 — Self-hosted opening grip-drag SSoT (centred-box behaviour).
 *
 * A free-standing (self-hosted) opening has NO host wall, so — unlike the
 * wall-hosted opening (slide-along-wall + flip-handing) — it behaves like every
 * other free-standing parametric box (furniture / MEP / floorplan-symbol):
 *   • MOVE     → free 2D translate of `selfHost.anchor`
 *   • ROTATION → real drag-rotate of `selfHost.rotationRad` (NOT a handing flip)
 *   • CORNER   → opposite-corner-fixed resize of BOTH `width` (μήκος, along axis)
 *               and `selfHost.hostThicknessMm` (πλάτος/πάχος, across), the latter
 *               clamped to `[MIN, MAX]_SELF_HOST_THICKNESS_MM` (Giorgio 2026-07-09).
 *
 * This is delegated 100% to the shared centred-box grip SSoT
 * (`createCentredBoxGripAdapter`, ADR-602) — NO re-implemented rotation/resize
 * math (N.18). The opening's params ⇄ box-params field remap lives in the
 * bridge below (`selfHost.anchor` mm ⇄ box `position` scene via `mmScaleFor`;
 * `rotationRad` ⇄ `rotation` deg; `width` ⇄ box `width`; `hostThicknessMm` ⇄
 * box `length` with the MAX clamp on the fold-back).
 *
 * @see bim/grips/create-centred-box-grip-adapter.ts — the adapter factory (ADR-602)
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md §Decision 4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningEntity, OpeningParams } from '../types/opening-types';
import type { OpeningGripKind } from '../../hooks/useGripMovement';
import {
  MIN_OPENING_WIDTH_MM,
  MIN_SELF_HOST_THICKNESS_MM,
  MAX_SELF_HOST_THICKNESS_MM,
} from '../types/opening-types';
// ADR-615 — `DEFAULT_SELF_HOST_THICKNESS_MM` canonical home is `opening-host.ts` (SSoT), the SAME
// source `opening-completion.ts` imports it from — NOT `opening-types.ts` (μηδέν διπλότυπη σταθερά, N.18).
import { DEFAULT_SELF_HOST_THICKNESS_MM } from '../geometry/opening-host';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { clamp } from '../../utils/scalar-math';
import {
  createCentredBoxGripAdapter,
  buildCentredBoxKindMaps,
} from '../grips/create-centred-box-grip-adapter';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** Drag input for a self-hosted opening grip (delta-based, mirror the box SSoT). */
export interface SelfHostedOpeningGripDragInput {
  readonly originalParams: OpeningParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** DXF canvas scene-units — reconciles `selfHost.anchor` (mm) ⇄ box position (scene). */
  readonly sceneUnits: SceneUnits;
  /** ORTHO (F8) → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
}

/**
 * Build the centred-box adapter for a self-hosted opening at a given `sceneUnits`
 * (captured in the bridge so `selfHost.anchor` mm ⇄ box `position` scene stays
 * exact even off canonical-mm scenes). Cheap (two closures) — built per drag.
 */
function buildSelfHostedOpeningAdapter(sceneUnits: SceneUnits) {
  const s = mmToSceneUnits(sceneUnits) || 1;
  return createCentredBoxGripAdapter<OpeningEntity, OpeningParams, OpeningGripKind>({
    ...buildCentredBoxKindMaps('opening'),
    // Let each dimension reach its own floor; per-dim clamps live in `fromBoxPatch`.
    minDimensionMm: Math.min(MIN_OPENING_WIDTH_MM, MIN_SELF_HOST_THICKNESS_MM),
    toBoxParams: (p) => {
      const a = p.selfHost?.anchor ?? { x: 0, y: 0, z: 0 };
      return {
        position: { x: a.x * s, y: a.y * s, z: a.z * s },
        rotation: (p.selfHost?.rotationRad ?? 0) * RAD_TO_DEG,
        width: p.width, // μήκος (along axis)
        length: p.selfHost?.hostThicknessMm ?? DEFAULT_SELF_HOST_THICKNESS_MM, // πλάτος (across)
        sceneUnits,
      };
    },
    fromBoxPatch: (orig, patch) => {
      const sh = orig.selfHost;
      if (!sh) return orig;
      return {
        ...orig,
        width: Math.max(MIN_OPENING_WIDTH_MM, patch.width),
        selfHost: {
          ...sh,
          anchor: { x: patch.position.x / s, y: patch.position.y / s, z: sh.anchor.z },
          rotationRad: patch.rotation * DEG_TO_RAD,
          hostThicknessMm: clamp(
            patch.length,
            MIN_SELF_HOST_THICKNESS_MM,
            MAX_SELF_HOST_THICKNESS_MM,
          ),
        },
      };
    },
    toGripInfo: (base, kind) => ({ ...base, gripKind: { on: 'opening', kind } }),
  });
}

/**
 * ADR-615 — self-hosted opening grip-drag → new `OpeningParams` (centred-box
 * SSoT). Handles `opening-move` / `opening-rotation` / `opening-corner-*`; any
 * other kind (e.g. `opening-facing`) yields `originalParams` unchanged so the
 * caller can layer its own host-agnostic toggle. Returns `originalParams`
 * referentially unchanged on any no-op (commit short-circuit).
 */
export function applySelfHostedBoxGripDrag(
  kind: OpeningGripKind,
  input: Readonly<SelfHostedOpeningGripDragInput>,
): OpeningParams {
  const adapter = buildSelfHostedOpeningAdapter(input.sceneUnits);
  return adapter.applyGripDrag(kind, {
    originalParams: input.originalParams,
    delta: input.delta,
    ortho: input.ortho,
  });
}
