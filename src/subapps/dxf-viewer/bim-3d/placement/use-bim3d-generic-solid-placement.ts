'use client';

/**
 * ADR-684 / ADR-605 — useBim3DGenericSolidPlacement hook.
 *
 * Point-based generic-solid placement on the 3D canvas. Thin binding over the
 * `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'generic-solid'` AND the viewport is in 3D, it projects the
 * cursor onto the mounting-elevation work-plane and hands the point to the 2D
 * `useGenericSolidTool` via the `bim:place-generic-solid-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { genericSolidToolBridgeStore } from '../../ui/ribbon/hooks/bridge/generic-solid-tool-bridge-store';
import { DEFAULT_GENERIC_SOLID_MOUNTING_ELEVATION_MM } from '../../bim/entities/generic-solid/generic-solid-types';

export const useBim3DGenericSolidPlacement = createBim3DPointPlacementHook({
  ghostKind: 'generic-solid',
  tools: ['generic-solid'],
  bridgeStore: genericSolidToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_GENERIC_SOLID_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-generic-solid-3d',
});
