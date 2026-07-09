'use client';

/**
 * ADR-408 Φ3 / ADR-605 — useBim3DElectricalPanelPlacement hook.
 *
 * Point-based electrical panel placement on the 3D canvas. Thin binding over the
 * `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed while
 * `activeTool === 'electrical-panel'` AND the viewport is in 3D, it projects the
 * cursor onto the mounting-elevation work-plane and hands the point to the 2D
 * `useElectricalPanelTool` via the `bim:place-electrical-panel-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import { DEFAULT_PANEL_MOUNTING_ELEVATION_MM } from '../../bim/types/electrical-panel-types';

export const useBim3DElectricalPanelPlacement = createBim3DPointPlacementHook({
  ghostKind: 'electrical-panel',
  tools: ['electrical-panel'],
  bridgeStore: electricalPanelToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_PANEL_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-electrical-panel-3d',
});
