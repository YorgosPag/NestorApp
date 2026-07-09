/**
 * ADR-615 — Self-hosted (free-standing) Opening Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit "face-based" / free-standing family
 * placement, no BIM wall host): idle → awaitingPosition → committed →
 * awaitingPosition (continuous). Places an `OpeningEntity` directly on
 * imported DXF lines — the synthetic host is `selfOpeningHost()`
 * (ADR-615 §Decision 1), NOT a `WallEntity`. ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in
 * `createSingleClickPlacementTool` (mirrors `useFurnitureTool.ts` — this file
 * is the thin per-entity config, NOT a re-implemented FSM). The self-opening
 * tool carries ONE extra state field — `rotationRad`, the orientation of the
 * synthetic host axis (`OpeningSelfHost.rotationRad`) — merged into the
 * commit/ghost overrides via `resolveCommitOverrides` and exposed through the
 * `useExtension` escape hatch (`setRotationRad`) + a `setKind` convenience
 * (mirrors the ribbon "D" kind-switch UX of the wall-hosted opening tool).
 * Public API shape mirrors every other `createSingleClickPlacementTool`
 * consumer (`CorePlacementResult<...>` + the tool's own extra setters).
 *
 * Orientation resolution (ADR-615 §Decision 3): `rotationRad` defaults to 0
 * and is override-driven (ribbon / Dynamic-Input angle field). Snapping the
 * orientation to the nearest DXF line under the cursor is a natural follow-up
 * (reusing the existing snap engine) but is intentionally NOT built here — no
 * new snap system, per ADR-615 scope.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useCallback } from 'react';
import type { Point3D } from '../../bim/types/bim-base';
import type { OpeningEntity, OpeningKind } from '../../bim/types/opening-types';
import {
  buildDefaultSelfOpeningParams,
  buildSelfOpeningEntity,
  type OpeningParamOverrides,
  type SceneUnits,
} from './opening-completion';
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
import { selfOpeningHost } from '../../bim/geometry/opening-host';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type SelfOpeningToolPhase = 'idle' | 'awaitingPosition' | 'committed';

/**
 * ADR-615 — self-opening overrides = the shared `OpeningParamOverrides`
 * (kind/width/height/sill/handing/…) PLUS the synthetic-host orientation.
 * `rotationRad` is NOT part of `OpeningParams` overlay resolution (it feeds
 * `buildDefaultSelfOpeningParams`'s dedicated 2nd argument) — kept as a
 * sibling field here so the ribbon/Dynamic-Input can drive it the same way
 * as every other override.
 */
export interface SelfOpeningParamOverrides extends OpeningParamOverrides {
  /** Radians — orientation of the synthetic host axis (default 0). */
  readonly rotationRad?: number;
}

export interface SelfOpeningToolState {
  readonly phase: SelfOpeningToolPhase;
  readonly rotationRad: number;
  readonly overrides: SelfOpeningParamOverrides;
  readonly error: string | null;
}

export interface UseSelfOpeningToolOptions {
  /** Callback fired after an `OpeningEntity` is built & committed. */
  readonly onOpeningCreated?: (entity: OpeningEntity) => void;
  /** Layer ID at which the OpeningEntity is registered. */
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface SelfOpeningExtraApi {
  /** Set the synthetic-host axis orientation (radians). */
  setRotationRad(rotationRad: number): void;
  /** Switch active kind (mirrors `useOpeningTool.setKind`). */
  setKind(kind: OpeningKind): void;
}

// ADR-600 — the result contract IS the factory core type + the rotation/kind setters.
export type UseSelfOpeningToolResult = CorePlacementResult<
  SelfOpeningToolState,
  SelfOpeningParamOverrides
> &
  SelfOpeningExtraApi;

const useSelfOpeningPlacement = createSingleClickPlacementTool<
  OpeningEntity,
  ReturnType<typeof buildDefaultSelfOpeningParams>,
  SelfOpeningParamOverrides,
  { rotationRad: number },
  SelfOpeningExtraApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  initialExtra: { rotationRad: 0 },
  buildParams: (pt, overrides) => {
    const anchor: Point3D = { x: pt.x, y: pt.y, z: 0 };
    return buildDefaultSelfOpeningParams(anchor, overrides.rotationRad ?? 0, overrides);
  },
  buildEntity: (params, levelId) => buildSelfOpeningEntity(params, levelId),
  computeFootprint: (params) =>
    computeOpeningGeometry(params, selfOpeningHost(params, 'mm'), 'mm').outline.vertices,
  resolveCommitOverrides: (s) => ({ ...s.overrides, rotationRad: s.rotationRad }),
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.selfOpening.statusPosition' : ''),
  useExtension: ({ setState, setParamOverrides }) => {
    const setRotationRad = useCallback(
      (rotationRad: number) => setState((prev) => ({ ...prev, rotationRad, error: null })),
      [setState],
    );
    const setKind = useCallback(
      (kind: OpeningKind) => setParamOverrides({ kind }),
      [setParamOverrides],
    );
    return { setRotationRad, setKind };
  },
});

export function useSelfOpeningTool(
  options: UseSelfOpeningToolOptions = {},
): UseSelfOpeningToolResult {
  return useSelfOpeningPlacement({
    onCreated: options.onOpeningCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
