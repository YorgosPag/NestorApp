/**
 * Action routing extracted from `useRibbonCommands` so the composer hook stays
 * under the 500-line GOL limit (N.7.1). Pure dispatcher — same prefix-routing
 * logic, lifted verbatim out of the `onAction` callback. Each bridge no-ops on
 * keys it doesn't own; the prefix checks short-circuit to the owning bridge,
 * falling through to the generic `wrappedHandleAction` for unowned keys.
 */

import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import type { UseRibbonCommandsProps } from './useRibbonCommands-types';
import { isMepCircuitActionKey } from './bridge/mep-circuit-command-keys';
import { isMepPipeNetworkActionKey } from './bridge/mep-pipe-network-command-keys';
import { isWaterSupplyActionKey } from './bridge/water-auto-supply-command-keys';
import { isDrainageAutoActionKey } from './bridge/drainage-auto-command-keys';
import { isHeatingAutoActionKey } from './bridge/heating-auto-command-keys';
import { isElectricalAutoActionKey } from './bridge/electrical-auto-command-keys';
import { isElectricalWeakAutoActionKey } from './bridge/electrical-weak-auto-command-keys';
import { isHvacAutoActionKey } from './bridge/hvac-auto-command-keys';
import { isFireAutoActionKey } from './bridge/fire-auto-command-keys';
import { isGasAutoActionKey } from './bridge/gas-auto-command-keys';
import { isClashDetectionActionKey } from './bridge/clash-detection-command-keys';
import { isMepFixtureActionKey } from './bridge/mep-fixture-command-keys';
import { isMepManifoldActionKey } from './bridge/mep-manifold-command-keys';
import { isElectricalPanelActionKey } from './bridge/electrical-panel-command-keys';
import { isMepRadiatorActionKey } from './bridge/mep-radiator-command-keys';
import { isMepBoilerActionKey } from './bridge/mep-boiler-command-keys';
import { isMepWaterHeaterActionKey } from './bridge/mep-water-heater-command-keys';
import { isMepUnderfloorActionKey } from './bridge/mep-underfloor-command-keys';
import { isMepSegmentActionKey } from './bridge/mep-segment-command-keys';
import { isFurnitureActionKey } from './bridge/furniture-command-keys';
import { isStairActionKey } from './bridge/stair-command-keys';
import { isWallActionKey } from './bridge/wall-command-keys';
import { isOpeningActionKey } from './bridge/opening-command-keys';
import { isSlabActionKey } from './bridge/slab-command-keys';
import { isRoofActionKey } from './bridge/roof-command-keys';
import { isFloorFinishActionKey } from './useRibbonFloorFinishBridge';
import { isWallCoveringActionKey } from './useRibbonWallCoveringBridge';
import { isHatchActionKey } from './useRibbonHatchBridge';
import { isThermalSpaceActionKey } from './useRibbonThermalSpaceBridge';
import { isColumnActionKey } from './bridge/column-command-keys';
import { isBeamActionKey } from './bridge/beam-command-keys';
import { isFoundationActionKey } from './bridge/foundation-command-keys';
import { isSlabOpeningActionKey } from './bridge/slab-opening-command-keys';
import { isContextualTabCloseAction } from './bridge/contextual-tab-close';

// ADR-363 — «Κλείσιμο» SSoT predicate lives in a dependency-free module so it
// is unit-testable without the heavy bridge import graph. Re-exported here for
// the existing call-site / tests.
export { isContextualTabCloseAction };

/** The subset of `useRibbonCommands` props that own ribbon action keys. */
export type RibbonActionBridges = Pick<
  UseRibbonCommandsProps,
  | 'closeContextualTab'
  | 'wallBridge'
  | 'openingBridge'
  | 'slabBridge'
  | 'roofBridge'
  | 'floorFinishBridge'
  | 'wallCoveringBridge'
  | 'hatchBridge'
  | 'thermalSpaceBridge'
  | 'columnBridge'
  | 'beamBridge'
  | 'foundationBridge'
  | 'slabOpeningBridge'
  | 'stairBridge'
  | 'mepCircuitBridge'
  | 'mepPipeNetworkBridge'
  | 'waterAutoSupplyBridge'
  | 'drainageAutoBridge'
  | 'heatingAutoBridge'
  | 'electricalAutoBridge'
  | 'electricalWeakAutoBridge'
  | 'hvacAutoBridge'
  | 'fireAutoBridge'
  | 'gasAutoBridge'
  | 'clashDetectionBridge'
  | 'mepFixtureBridge'
  | 'mepManifoldBridge'
  | 'electricalPanelBridge'
  | 'mepRadiatorBridge'
  | 'mepBoilerBridge'
  | 'mepWaterHeaterBridge'
  | 'mepUnderfloorBridge'
  | 'mepSegmentBridge'
  | 'furnitureBridge'
  | 'wrappedHandleAction'
>;

/**
 * ADR-363 Phase 1E — Route a ribbon action to the owning bridge, falling back
 * to the generic `wrappedHandleAction` (DxfViewerContent handler) for any key
 * no bridge owns.
 */
export function routeRibbonAction(
  action: string,
  data: RibbonActionPayload | undefined,
  bridges: RibbonActionBridges,
): void {
  // ADR-363 — «Κλείσιμο» is a uniform deselect for every contextual tab.
  // Intercept BEFORE per-bridge routing so it works regardless of which bridge
  // owns the key (the owning bridge's `isXActionKey` would otherwise swallow it
  // and no-op). Reuses the single working primitive `clearAll()`.
  if (isContextualTabCloseAction(action)) {
    bridges.closeContextualTab();
    return;
  }
  if (isWallActionKey(action)) {
    bridges.wallBridge.onAction(action);
    return;
  }
  if (isOpeningActionKey(action)) {
    bridges.openingBridge.onAction(action);
    return;
  }
  if (isSlabActionKey(action)) {
    bridges.slabBridge.onAction(action);
    return;
  }
  if (isRoofActionKey(action)) {
    bridges.roofBridge.onAction(action);
    return;
  }
  if (isFloorFinishActionKey(action)) {
    bridges.floorFinishBridge.onAction(action);
    return;
  }
  if (isWallCoveringActionKey(action)) {
    bridges.wallCoveringBridge.onAction(action);
    return;
  }
  if (isHatchActionKey(action)) {
    bridges.hatchBridge.onAction(action);
    return;
  }
  if (isThermalSpaceActionKey(action)) {
    bridges.thermalSpaceBridge.onAction(action);
    return;
  }
  if (isColumnActionKey(action)) {
    bridges.columnBridge.onAction(action);
    return;
  }
  if (isBeamActionKey(action)) {
    bridges.beamBridge.onAction(action);
    return;
  }
  if (isFoundationActionKey(action)) {
    bridges.foundationBridge.onAction(action);
    return;
  }
  if (isSlabOpeningActionKey(action)) {
    bridges.slabOpeningBridge.onAction(action);
    return;
  }
  if (isStairActionKey(action)) {
    bridges.stairBridge.onAction(action);
    return;
  }
  if (isMepCircuitActionKey(action)) {
    bridges.mepCircuitBridge.onAction(action);
    return;
  }
  if (isMepPipeNetworkActionKey(action)) {
    bridges.mepPipeNetworkBridge.onAction(action);
    return;
  }
  if (isWaterSupplyActionKey(action)) {
    bridges.waterAutoSupplyBridge.onAction(action);
    return;
  }
  if (isDrainageAutoActionKey(action)) {
    bridges.drainageAutoBridge.onAction(action);
    return;
  }
  if (isHeatingAutoActionKey(action)) {
    bridges.heatingAutoBridge.onAction(action);
    return;
  }
  if (isElectricalAutoActionKey(action)) {
    bridges.electricalAutoBridge.onAction(action);
    return;
  }
  if (isElectricalWeakAutoActionKey(action)) {
    bridges.electricalWeakAutoBridge.onAction(action);
    return;
  }
  if (isHvacAutoActionKey(action)) {
    bridges.hvacAutoBridge.onAction(action);
    return;
  }
  if (isFireAutoActionKey(action)) {
    bridges.fireAutoBridge.onAction(action);
    return;
  }
  if (isGasAutoActionKey(action)) {
    bridges.gasAutoBridge.onAction(action);
    return;
  }
  if (isClashDetectionActionKey(action)) {
    bridges.clashDetectionBridge.onAction(action);
    return;
  }
  if (isMepFixtureActionKey(action)) {
    bridges.mepFixtureBridge.onAction(action);
    return;
  }
  if (isMepManifoldActionKey(action)) {
    bridges.mepManifoldBridge.onAction(action);
    return;
  }
  if (isElectricalPanelActionKey(action)) {
    bridges.electricalPanelBridge.onAction(action);
    return;
  }
  if (isMepRadiatorActionKey(action)) {
    bridges.mepRadiatorBridge.onAction(action);
    return;
  }
  if (isMepUnderfloorActionKey(action)) {
    bridges.mepUnderfloorBridge.onAction(action);
    return;
  }
  if (isMepBoilerActionKey(action)) {
    bridges.mepBoilerBridge.onAction(action);
    return;
  }
  if (isMepWaterHeaterActionKey(action)) {
    bridges.mepWaterHeaterBridge.onAction(action);
    return;
  }
  if (isMepSegmentActionKey(action)) {
    bridges.mepSegmentBridge.onAction(action);
    return;
  }
  if (isFurnitureActionKey(action)) {
    bridges.furnitureBridge.onAction(action);
    return;
  }
  bridges.wrappedHandleAction(action, data);
}
