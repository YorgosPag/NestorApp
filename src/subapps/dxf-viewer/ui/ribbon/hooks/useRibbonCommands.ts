import React from 'react';
import { useAnimationStore } from '../../../bim-3d/animation/AnimationStore';
import { SNAP_STEP_PRESETS } from '../../../bim-3d/animation/snap-quantizer';
import type {
  RibbonCommandsApi,
  RibbonActionPayload,
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import type { UseRibbonCommandsProps } from './useRibbonCommands-types';
import { isStairBadgeKey, isStairPanelVisibilityKey } from '../../../bim/hooks/use-ribbon-stair-bridge';
import { isWallBadgeKey } from './useRibbonWallBridge';
import { isOpeningBadgeKey } from './useRibbonOpeningBridge';
import { isSlabBadgeKey } from './useRibbonSlabBridge';
import { isRoofBadgeKey } from './useRibbonRoofBridge';
import { isColumnBadgeKey, isColumnPanelVisibilityKey } from './useRibbonColumnBridge';
import { isBeamBadgeKey, isBeamPanelVisibilityKey } from './useRibbonBeamBridge';
import { isSlabOpeningBadgeKey } from './useRibbonSlabOpeningBridge';
import { isMepCircuitActionKey } from './bridge/mep-circuit-command-keys';
import { isMepPipeNetworkActionKey } from './bridge/mep-pipe-network-command-keys';
import { isWaterSupplyActionKey } from './bridge/water-auto-supply-command-keys';
import { isMepFixturePanelVisibilityKey } from './useRibbonMepFixtureBridge';
import { isMepFixtureRibbonKey, isMepFixtureRibbonStringKey, isMepFixtureActionKey } from './bridge/mep-fixture-command-keys';
import { isMepManifoldPanelVisibilityKey } from './useRibbonMepManifoldBridge';
import { isMepManifoldRibbonKey, isMepManifoldActionKey, isMepManifoldClassificationKey } from './bridge/mep-manifold-command-keys';
import { isMepRadiatorRibbonKey, isMepRadiatorRibbonStringKey, isMepRadiatorRibbonReadoutKey, isMepRadiatorActionKey } from './bridge/mep-radiator-command-keys';
import { isMepBoilerPanelVisibilityKey } from './useRibbonMepBoilerBridge';
import { isMepBoilerRibbonKey, isMepBoilerReadoutKey, isMepBoilerActionKey } from './bridge/mep-boiler-command-keys';
import { isMepWaterHeaterPanelVisibilityKey } from './useRibbonMepWaterHeaterBridge';
import { isMepWaterHeaterRibbonKey, isMepWaterHeaterActionKey } from './bridge/mep-water-heater-command-keys';
import { isMepUnderfloorPanelVisibilityKey } from './useRibbonMepUnderfloorBridge';
import { isMepUnderfloorRibbonKey, isMepUnderfloorActionKey } from './bridge/mep-underfloor-command-keys';
import { isMepSegmentPanelVisibilityKey } from './useRibbonMepSegmentBridge';
import { isMepSegmentRibbonKey, isMepSegmentRibbonStringKey, isMepSegmentActionKey } from './bridge/mep-segment-command-keys';
import { isFurniturePanelVisibilityKey } from './useRibbonFurnitureBridge';
import { isFurnitureRibbonKey, isFurnitureRibbonStringKey, isFurnitureActionKey } from './bridge/furniture-command-keys';
import { isFloorplanSymbolPanelVisibilityKey } from './useRibbonFloorplanSymbolBridge';
import { isFloorplanSymbolRibbonKey, isFloorplanSymbolRibbonStringKey } from './bridge/floorplan-symbol-command-keys';
import { isMepFixtureLibraryKey, isMepFixtureLibraryStringKey } from './bridge/mep-fixture-library-command-keys';
import { isMepRiserKey, isMepRiserStringKey } from './bridge/mep-riser-command-keys';
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey, isStairActionKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey, isWallActionKey } from './bridge/wall-command-keys';
import { isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningActionKey, isOpeningTagStyleComboboxKey, isOpeningTagStyleToggleKey } from './bridge/opening-command-keys';
import { isSlabRibbonKey, isSlabRibbonStringKey, isSlabActionKey } from './bridge/slab-command-keys';
import { isRoofRibbonKey, isRoofRibbonStringKey, isRoofRibbonToggleKey, isRoofActionKey } from './bridge/roof-command-keys';
import { isFloorFinishActionKey } from './useRibbonFloorFinishBridge';
import { isFloorFinishRibbonNumberKey, isFloorFinishRibbonStringKey } from './bridge/floor-finish-command-keys';
import { isThermalSpaceActionKey } from './useRibbonThermalSpaceBridge';
import { isThermalSpaceRibbonNumberKey, isThermalSpaceRibbonStringKey } from './bridge/thermal-space-command-keys';
import { isColumnRibbonKey, isColumnRibbonStringKey, isColumnActionKey } from './bridge/column-command-keys';
import { isBeamRibbonKey, isBeamRibbonStringKey, isBeamActionKey } from './bridge/beam-command-keys';
import { isSlabOpeningRibbonStringKey, isSlabOpeningActionKey } from './bridge/slab-opening-command-keys';
import { isLineToolRibbonKey } from './bridge/line-tool-command-keys';
import { isXlineRibbonKey } from './bridge/xline-command-keys';

export type { UseRibbonCommandsProps };

/** Combobox options for the animation snap step (mirrors SNAP_STEP_PRESETS). */
const SNAP_STEP_COMBOBOX_OPTIONS = SNAP_STEP_PRESETS.map((v) => ({
  value: String(v),
  labelKey: `animation.snapStepOptions.${v % 1 === 0 ? String(Math.round(v)) : String(v)}`,
}));

export function useRibbonCommands({
  activeTool,
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  canUndo,
  canRedo,
  textEditorBridge,
  arrayBridge,
  stairBridge,
  wallBridge,
  openingBridge,
  slabBridge,
  roofBridge,
  floorFinishBridge,
  thermalSpaceBridge,
  columnBridge,
  beamBridge,
  slabOpeningBridge,
  mepCircuitBridge,
  mepPipeNetworkBridge,
  waterAutoSupplyBridge,
  mepFixtureBridge,
  mepManifoldBridge,
  mepRadiatorBridge,
  mepBoilerBridge,
  mepWaterHeaterBridge,
  mepUnderfloorBridge,
  mepSegmentBridge,
  furnitureBridge,
  floorplanSymbolBridge,
  mepFixtureLibraryBridge,
  mepRiserBridge,
  lineToolBridge,
  xlineModeBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  // ADR-366 §C.1.b snap-to-grid — subscribe so ribbon re-renders on snap change.
  const snapEnabled = useAnimationStore((s) => s.snapEnabled);
  const snapStepUnits = useAnimationStore((s) => s.snapStepUnits);

  // Compose: stair-prefixed keys → stairBridge; array-prefixed → arrayBridge;
  // everything else falls through to the text-editor bridge. All bridges
  // no-op on keys they don't own, but the prefix checks short-circuit.
  const onComboboxChange = React.useCallback(
    (key: string, value: string) => {
      if (key === 'animation.snap-step') {
        const step = parseFloat(value);
        if (!Number.isNaN(step) && step > 0) {
          useAnimationStore.getState().setSnapStepUnits(step);
        }
        return;
      }
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) {
        stairBridge.onComboboxChange(key, value);
        return;
      }
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) {
        wallBridge.onComboboxChange(key, value);
        return;
      }
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key) || isOpeningTagStyleComboboxKey(key)) {
        openingBridge.onComboboxChange(key, value);
        return;
      }
      if (isSlabRibbonKey(key) || isSlabRibbonStringKey(key)) {
        slabBridge.onComboboxChange(key, value);
        return;
      }
      if (isRoofRibbonKey(key) || isRoofRibbonStringKey(key)) {
        roofBridge.onComboboxChange(key, value);
        return;
      }
      if (isFloorFinishRibbonNumberKey(key) || isFloorFinishRibbonStringKey(key)) {
        floorFinishBridge.onComboboxChange(key, value);
        return;
      }
      if (isThermalSpaceRibbonNumberKey(key) || isThermalSpaceRibbonStringKey(key)) {
        thermalSpaceBridge.onComboboxChange(key, value);
        return;
      }
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key)) {
        columnBridge.onComboboxChange(key, value);
        return;
      }
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key)) {
        beamBridge.onComboboxChange(key, value);
        return;
      }
      if (isSlabOpeningRibbonStringKey(key)) {
        slabOpeningBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepFixtureRibbonKey(key) || isMepFixtureRibbonStringKey(key)) {
        mepFixtureBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepManifoldRibbonKey(key) || isMepManifoldClassificationKey(key)) {
        mepManifoldBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepRadiatorRibbonKey(key) || isMepRadiatorRibbonStringKey(key)) {
        mepRadiatorBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepBoilerRibbonKey(key)) {
        mepBoilerBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepWaterHeaterRibbonKey(key)) {
        mepWaterHeaterBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepUnderfloorRibbonKey(key)) {
        mepUnderfloorBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepSegmentRibbonKey(key) || isMepSegmentRibbonStringKey(key)) {
        mepSegmentBridge.onComboboxChange(key, value);
        return;
      }
      if (isFurnitureRibbonKey(key) || isFurnitureRibbonStringKey(key)) {
        furnitureBridge.onComboboxChange(key, value);
        return;
      }
      if (isFloorplanSymbolRibbonKey(key) || isFloorplanSymbolRibbonStringKey(key)) {
        floorplanSymbolBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepFixtureLibraryKey(key) || isMepFixtureLibraryStringKey(key)) {
        mepFixtureLibraryBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepRiserKey(key) || isMepRiserStringKey(key)) {
        mepRiserBridge.onComboboxChange(key, value);
        return;
      }
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) {
        arrayBridge.onComboboxChange(key, value);
        return;
      }
      if (isLineToolRibbonKey(key)) {
        lineToolBridge.onComboboxChange(key, value);
        return;
      }
      if (isXlineRibbonKey(key)) {
        xlineModeBridge.onComboboxChange(key, value);
        return;
      }
      textEditorBridge.onComboboxChange(key, value);
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, thermalSpaceBridge, columnBridge, beamBridge, slabOpeningBridge, mepFixtureBridge, mepManifoldBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (key === 'animation.snap-step') {
        return { value: String(snapStepUnits), options: SNAP_STEP_COMBOBOX_OPTIONS };
      }
      if (isStairRibbonKey(key) || isStairRibbonStringKey(key)) return stairBridge.getComboboxState(key);
      if (isWallRibbonKey(key) || isWallRibbonStringKey(key) || isWallRibbonToggleKey(key)) return wallBridge.getComboboxState(key);
      if (isOpeningRibbonKey(key) || isOpeningRibbonStringKey(key) || isOpeningTagStyleComboboxKey(key)) return openingBridge.getComboboxState(key);
      if (isSlabRibbonKey(key) || isSlabRibbonStringKey(key)) return slabBridge.getComboboxState(key);
      if (isRoofRibbonKey(key) || isRoofRibbonStringKey(key)) return roofBridge.getComboboxState(key);
      if (isFloorFinishRibbonNumberKey(key) || isFloorFinishRibbonStringKey(key)) return floorFinishBridge.getComboboxState(key);
      if (isThermalSpaceRibbonNumberKey(key) || isThermalSpaceRibbonStringKey(key)) return thermalSpaceBridge.getComboboxState(key);
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key)) return columnBridge.getComboboxState(key);
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key)) return beamBridge.getComboboxState(key);
      if (isSlabOpeningRibbonStringKey(key)) return slabOpeningBridge.getComboboxState(key);
      if (isMepFixtureRibbonKey(key) || isMepFixtureRibbonStringKey(key)) return mepFixtureBridge.getComboboxState(key);
      if (isMepManifoldRibbonKey(key) || isMepManifoldClassificationKey(key)) return mepManifoldBridge.getComboboxState(key);
      if (isMepRadiatorRibbonKey(key) || isMepRadiatorRibbonStringKey(key) || isMepRadiatorRibbonReadoutKey(key)) return mepRadiatorBridge.getComboboxState(key);
      if (isMepBoilerRibbonKey(key) || isMepBoilerReadoutKey(key)) return mepBoilerBridge.getComboboxState(key);
      if (isMepWaterHeaterRibbonKey(key)) return mepWaterHeaterBridge.getComboboxState(key);
      if (isMepUnderfloorRibbonKey(key)) return mepUnderfloorBridge.getComboboxState(key);
      if (isMepSegmentRibbonKey(key) || isMepSegmentRibbonStringKey(key)) return mepSegmentBridge.getComboboxState(key);
      if (isFurnitureRibbonKey(key) || isFurnitureRibbonStringKey(key)) return furnitureBridge.getComboboxState(key);
      if (isFloorplanSymbolRibbonKey(key) || isFloorplanSymbolRibbonStringKey(key)) return floorplanSymbolBridge.getComboboxState(key);
      if (isMepFixtureLibraryKey(key) || isMepFixtureLibraryStringKey(key)) return mepFixtureLibraryBridge.getComboboxState(key);
      if (isMepRiserKey(key) || isMepRiserStringKey(key)) return mepRiserBridge.getComboboxState(key);
      if (isArrayRibbonKey(key) || isArrayRibbonStringKey(key)) return arrayBridge.getComboboxState(key);
      if (isLineToolRibbonKey(key)) return lineToolBridge.getComboboxState(key);
      if (isXlineRibbonKey(key)) return xlineModeBridge.getComboboxState(key);
      return textEditorBridge.getComboboxState(key);
    },
    [snapStepUnits, stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, thermalSpaceBridge, columnBridge, beamBridge, slabOpeningBridge, mepFixtureBridge, mepManifoldBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
  );

  const onToggle = React.useCallback(
    (key: string, next: boolean) => {
      if (isWallRibbonToggleKey(key)) {
        wallBridge.onToggle(key, next);
        return;
      }
      if (isArrayRibbonToggleKey(key)) {
        arrayBridge.onToggle(key, next);
        return;
      }
      if (isOpeningTagStyleToggleKey(key)) {
        openingBridge.onToggle(key, next);
        return;
      }
      if (isRoofRibbonToggleKey(key)) {
        roofBridge.onToggle(key, next);
        return;
      }
      textEditorBridge.onToggle(key, next);
    },
    [wallBridge, arrayBridge, openingBridge, roofBridge, textEditorBridge],
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (key === 'animation.snap-toggle') return snapEnabled;
      if (isWallRibbonToggleKey(key)) return wallBridge.getToggleState(key);
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      if (isOpeningTagStyleToggleKey(key)) return openingBridge.getToggleState(key);
      if (isRoofRibbonToggleKey(key)) return roofBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [snapEnabled, wallBridge, arrayBridge, openingBridge, roofBridge, textEditorBridge],
  );

  // ADR-358 Phase 7b1 — Stair bridge owns badge keys; ADR-363 Phase 1B adds
  // wall badge keys for the violation indicator on the wall contextual tab.
  const getBadgeState = React.useCallback(
    (badgeKey: string): boolean => {
      if (isStairBadgeKey(badgeKey)) return stairBridge.getBadgeState(badgeKey);
      if (isWallBadgeKey(badgeKey)) return wallBridge.getBadgeState(badgeKey);
      if (isOpeningBadgeKey(badgeKey)) return openingBridge.getBadgeState(badgeKey);
      if (isSlabBadgeKey(badgeKey)) return slabBridge.getBadgeState(badgeKey);
      if (isRoofBadgeKey(badgeKey)) return roofBridge.getBadgeState(badgeKey);
      if (isColumnBadgeKey(badgeKey)) return columnBridge.getBadgeState(badgeKey);
      if (isBeamBadgeKey(badgeKey)) return beamBridge.getBadgeState(badgeKey);
      if (isSlabOpeningBadgeKey(badgeKey)) return slabOpeningBridge.getBadgeState(badgeKey);
      return false;
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, columnBridge, beamBridge, slabOpeningBridge],
  );

  // ADR-358 Phase 7b2b-β Stream F — Only the stair bridge owns visibility
  // keys today. ADR-363 Phase 8D — column bridge added (polygon/ishape panels).
  // Future bridges add their own owned set + branch here. Default `true` for
  // unowned keys = panel visible (no breaking change).
  const getPanelVisibility = React.useCallback(
    (visibilityKey: string): boolean => {
      if (isStairPanelVisibilityKey(visibilityKey)) return stairBridge.getPanelVisibility(visibilityKey);
      if (isColumnPanelVisibilityKey(visibilityKey)) return columnBridge.getPanelVisibility(visibilityKey);
      if (isBeamPanelVisibilityKey(visibilityKey)) return beamBridge.getPanelVisibility(visibilityKey);
      if (isMepFixturePanelVisibilityKey(visibilityKey)) return mepFixtureBridge.getPanelVisibility(visibilityKey);
      if (isMepManifoldPanelVisibilityKey(visibilityKey)) return mepManifoldBridge.getPanelVisibility(visibilityKey);
      if (isMepBoilerPanelVisibilityKey(visibilityKey)) return mepBoilerBridge.getPanelVisibility(visibilityKey);
      if (isMepWaterHeaterPanelVisibilityKey(visibilityKey)) return mepWaterHeaterBridge.getPanelVisibility(visibilityKey);
      if (isMepUnderfloorPanelVisibilityKey(visibilityKey)) return mepUnderfloorBridge.getPanelVisibility(visibilityKey);
      if (isMepSegmentPanelVisibilityKey(visibilityKey)) return mepSegmentBridge.getPanelVisibility(visibilityKey);
      if (isFurniturePanelVisibilityKey(visibilityKey)) return furnitureBridge.getPanelVisibility(visibilityKey);
      if (isFloorplanSymbolPanelVisibilityKey(visibilityKey)) return floorplanSymbolBridge.getPanelVisibility(visibilityKey);
      return true;
    },
    [stairBridge, columnBridge, beamBridge, mepFixtureBridge, mepManifoldBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge],
  );

  // ADR-363 Phase 1E — Wall action keys (delete) handled by bridge before
  // falling through to the generic DxfViewerContent action handler.
  const onAction = React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (isWallActionKey(action)) {
        wallBridge.onAction(action);
        return;
      }
      if (isOpeningActionKey(action)) {
        openingBridge.onAction(action);
        return;
      }
      if (isSlabActionKey(action)) {
        slabBridge.onAction(action);
        return;
      }
      if (isRoofActionKey(action)) {
        roofBridge.onAction(action);
        return;
      }
      if (isFloorFinishActionKey(action)) {
        floorFinishBridge.onAction(action);
        return;
      }
      if (isThermalSpaceActionKey(action)) {
        thermalSpaceBridge.onAction(action);
        return;
      }
      if (isColumnActionKey(action)) {
        columnBridge.onAction(action);
        return;
      }
      if (isBeamActionKey(action)) {
        beamBridge.onAction(action);
        return;
      }
      if (isSlabOpeningActionKey(action)) {
        slabOpeningBridge.onAction(action);
        return;
      }
      if (isStairActionKey(action)) {
        stairBridge.onAction(action);
        return;
      }
      if (isMepCircuitActionKey(action)) {
        mepCircuitBridge.onAction(action);
        return;
      }
      if (isMepPipeNetworkActionKey(action)) {
        mepPipeNetworkBridge.onAction(action);
        return;
      }
      if (isWaterSupplyActionKey(action)) {
        waterAutoSupplyBridge.onAction(action);
        return;
      }
      if (isMepFixtureActionKey(action)) {
        mepFixtureBridge.onAction(action);
        return;
      }
      if (isMepManifoldActionKey(action)) {
        mepManifoldBridge.onAction(action);
        return;
      }
      if (isMepRadiatorActionKey(action)) {
        mepRadiatorBridge.onAction(action);
        return;
      }
      if (isMepUnderfloorActionKey(action)) {
        mepUnderfloorBridge.onAction(action);
        return;
      }
      if (isMepBoilerActionKey(action)) {
        mepBoilerBridge.onAction(action);
        return;
      }
      if (isMepWaterHeaterActionKey(action)) {
        mepWaterHeaterBridge.onAction(action);
        return;
      }
      if (isMepSegmentActionKey(action)) {
        mepSegmentBridge.onAction(action);
        return;
      }
      if (isFurnitureActionKey(action)) {
        furnitureBridge.onAction(action);
        return;
      }
      wrappedHandleAction(action, data);
    },
    [wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, thermalSpaceBridge, columnBridge, beamBridge, slabOpeningBridge, stairBridge, mepCircuitBridge, mepPipeNetworkBridge, waterAutoSupplyBridge, mepFixtureBridge, mepManifoldBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, wrappedHandleAction],
  );

  return React.useMemo(
    () => ({
      activeTool,
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    }),
    [
      activeTool,
      handleToolChange,
      handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getToggleState,
      getComboboxState,
      getBadgeState,
      getPanelVisibility,
    ],
  );
}
