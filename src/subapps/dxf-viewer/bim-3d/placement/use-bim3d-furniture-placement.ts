'use client';

/**
 * ADR-410 / ADR-605 — useBim3DFurniturePlacement hook.
 *
 * Point-based furniture placement on the 3D canvas. Thin binding over the
 * `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'furniture'` AND the viewport is in 3D, it projects the cursor
 * onto the mounting-elevation work-plane and hands the point to the 2D
 * `useFurnitureTool` via the `bim:place-furniture-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { furnitureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/furniture-tool-bridge-store';
import { DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM } from '../../bim/types/furniture-types';

export const useBim3DFurniturePlacement = createBim3DPointPlacementHook({
  ghostKind: 'furniture',
  tools: ['furniture'],
  bridgeStore: furnitureToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-furniture-3d',
});
