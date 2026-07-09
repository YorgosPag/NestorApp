'use client';

/**
 * ADR-408 Φ12 / ADR-605 — useBim3DMepManifoldPlacement hook.
 *
 * Point-based plumbing manifold (συλλέκτης) placement on the 3D canvas. Thin
 * binding over the `createBim3DPointPlacementHook` SSoT factory (ADR-605): armed
 * while `activeTool` is `mep-manifold` OR `mep-drainage-collector` (shared FSM/
 * bridge) AND the viewport is in 3D, it projects the cursor onto the mounting-
 * elevation work-plane and hands the point to the 2D `useMepManifoldTool` via the
 * `bim:place-mep-manifold-3d` EventBus bridge.
 *
 * @see create-bim3d-point-placement-hook.ts — the parametric single source
 */

import { createBim3DPointPlacementHook } from './create-bim3d-point-placement-hook';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-manifold-types';

export const useBim3DMepManifoldPlacement = createBim3DPointPlacementHook({
  ghostKind: 'mep-manifold',
  tools: ['mep-manifold', 'mep-drainage-collector'],
  bridgeStore: mepManifoldToolBridgeStore,
  defaultMountingElevationMm: DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM,
  placeEvent: 'bim:place-mep-manifold-3d',
});
