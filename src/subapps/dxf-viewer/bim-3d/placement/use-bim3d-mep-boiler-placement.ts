'use client';

/**
 * ADR-408 Εύρος Β #2 / ADR-605 — useBim3DMepBoilerPlacement hook.
 *
 * Point-based heating boiler (λέβητας) placement on the 3D canvas. Thin binding
 * over the `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'mep-boiler'` AND the viewport is in 3D, it projects the cursor
 * onto the mounting-elevation work-plane and hands the point to the 2D
 * `useMepBoilerTool` via the `bim:place-mep-boiler-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';
import { DEFAULT_BOILER_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-boiler-types';

export const useBim3DMepBoilerPlacement = createBim3DPointPlacementHook({
  ghostKind: 'mep-boiler',
  tools: ['mep-boiler'],
  bridgeStore: mepBoilerToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_BOILER_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-mep-boiler-3d',
});
