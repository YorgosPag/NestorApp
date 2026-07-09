'use client';

/**
 * ADR-408 Εύρος Β #1 / ADR-605 — useBim3DMepRadiatorPlacement hook.
 *
 * Point-based radiator (θερμαντικό σώμα) placement on the 3D canvas. Thin binding
 * over the `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'mep-radiator'` AND the viewport is in 3D, it projects the cursor
 * onto the mounting-elevation work-plane and hands the point to the 2D
 * `useMepRadiatorTool` via the `bim:place-mep-radiator-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import { DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-radiator-types';

export const useBim3DMepRadiatorPlacement = createBim3DPointPlacementHook({
  ghostKind: 'mep-radiator',
  tools: ['mep-radiator'],
  bridgeStore: mepRadiatorToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-mep-radiator-3d',
});
