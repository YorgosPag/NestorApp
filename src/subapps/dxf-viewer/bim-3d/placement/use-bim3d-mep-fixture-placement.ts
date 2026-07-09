'use client';

/**
 * ADR-406 / ADR-605 — useBim3DMepFixturePlacement hook.
 *
 * Point-based MEP fixture (luminaire / floor drain) placement on the 3D canvas.
 * Thin binding over the `createBim3DPointPlacementHook` SSoT factory (ADR-605):
 * armed while `activeTool` is `mep-fixture` OR `mep-floor-drain` (ADR-408 Φ14 — the
 * σιφώνι shares the fixture FSM/bridge) AND the viewport is in 3D, it projects the
 * cursor onto the mounting-elevation work-plane and hands the point to the 2D
 * `useMepFixtureTool` via the `bim:place-mep-fixture-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';
import { DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-fixture-types';

export const useBim3DMepFixturePlacement = createBim3DPointPlacementHook({
  ghostKind: 'mep-fixture',
  tools: ['mep-fixture', 'mep-floor-drain'],
  bridgeStore: mepFixtureToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-mep-fixture-3d',
});
