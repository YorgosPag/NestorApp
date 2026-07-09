'use client';

/**
 * ADR-408 DHW / ADR-605 — useBim3DMepWaterHeaterPlacement hook.
 *
 * Point-based water heater (θερμοσίφωνας) placement on the 3D canvas. Thin binding
 * over the `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'mep-water-heater'` AND the viewport is in 3D, it projects the
 * cursor onto the mounting-elevation work-plane and hands the point to the 2D
 * `useMepWaterHeaterTool` via the `bim:place-mep-water-heater-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';
import { DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-water-heater-types';

export const useBim3DMepWaterHeaterPlacement = createBim3DPointPlacementHook({
  ghostKind: 'mep-water-heater',
  tools: ['mep-water-heater'],
  bridgeStore: mepWaterHeaterToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-mep-water-heater-3d',
});
