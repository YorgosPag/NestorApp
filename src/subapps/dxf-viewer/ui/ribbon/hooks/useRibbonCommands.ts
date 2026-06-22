import React from 'react';
import { useAnimationStore } from '../../../bim-3d/animation/AnimationStore';
import { SNAP_STEP_COMBOBOX_OPTIONS } from './useRibbonCommands-snap-options';
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
import { isSlabBadgeKey, isSlabPanelVisibilityKey } from './useRibbonSlabBridge';
import { isRoofBadgeKey } from './useRibbonRoofBridge';
import { isColumnBadgeKey, isColumnPanelVisibilityKey } from './useRibbonColumnBridge';
import { isBeamBadgeKey, isBeamPanelVisibilityKey } from './useRibbonBeamBridge';
import { isSlabOpeningBadgeKey } from './useRibbonSlabOpeningBridge';
import { isMepFixturePanelVisibilityKey } from './useRibbonMepFixtureBridge';
import { isMepFixtureRibbonKey, isMepFixtureRibbonStringKey } from './bridge/mep-fixture-command-keys';
import { isMepManifoldPanelVisibilityKey } from './useRibbonMepManifoldBridge';
import { isMepManifoldRibbonKey, isMepManifoldClassificationKey } from './bridge/mep-manifold-command-keys';
import { isElectricalPanelPanelVisibilityKey } from './useRibbonElectricalPanelBridge';
import { isElectricalPanelRibbonKey } from './bridge/electrical-panel-command-keys';
import { isMepRadiatorRibbonKey, isMepRadiatorRibbonStringKey, isMepRadiatorRibbonReadoutKey } from './bridge/mep-radiator-command-keys';
import { isMepBoilerPanelVisibilityKey } from './useRibbonMepBoilerBridge';
import { isMepBoilerRibbonKey, isMepBoilerRibbonStringKey, isMepBoilerReadoutKey, isMepBoilerToggleKey } from './bridge/mep-boiler-command-keys';
import { isMepWaterHeaterPanelVisibilityKey } from './useRibbonMepWaterHeaterBridge';
import { isMepWaterHeaterRibbonKey } from './bridge/mep-water-heater-command-keys';
import { isMepUnderfloorPanelVisibilityKey } from './useRibbonMepUnderfloorBridge';
import { isMepUnderfloorRibbonKey } from './bridge/mep-underfloor-command-keys';
import { isMepSegmentPanelVisibilityKey } from './useRibbonMepSegmentBridge';
import { isMepSegmentRibbonKey, isMepSegmentRibbonStringKey } from './bridge/mep-segment-command-keys';
import { isFurniturePanelVisibilityKey } from './useRibbonFurnitureBridge';
import { isFurnitureRibbonKey, isFurnitureRibbonStringKey } from './bridge/furniture-command-keys';
import { isFloorplanSymbolPanelVisibilityKey } from './useRibbonFloorplanSymbolBridge';
import { isFloorplanSymbolRibbonKey, isFloorplanSymbolRibbonStringKey } from './bridge/floorplan-symbol-command-keys';
import { isMepFixtureLibraryKey, isMepFixtureLibraryStringKey } from './bridge/mep-fixture-library-command-keys';
import { isMepRiserKey, isMepRiserStringKey } from './bridge/mep-riser-command-keys';
import { isArrayRibbonKey, isArrayRibbonStringKey, isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isStairRibbonKey, isStairRibbonStringKey } from './bridge/stair-command-keys';
import { isWallRibbonKey, isWallRibbonStringKey, isWallRibbonToggleKey } from './bridge/wall-command-keys';
import { isOpeningRibbonKey, isOpeningRibbonStringKey, isOpeningTagStyleComboboxKey, isOpeningTagStyleToggleKey } from './bridge/opening-command-keys';
import { isSlabRibbonKey, isSlabRibbonStringKey } from './bridge/slab-command-keys';
import { isRoofRibbonKey, isRoofRibbonStringKey, isRoofRibbonToggleKey } from './bridge/roof-command-keys';
import { isFloorFinishRibbonNumberKey, isFloorFinishRibbonStringKey } from './bridge/floor-finish-command-keys';
import { isWallCoveringRibbonNumberKey, isWallCoveringRibbonStringKey } from './bridge/wall-covering-command-keys';
import { isHatchRibbonNumberKey, isHatchRibbonStringKey, isHatchRibbonToggleKey, isHatchRibbonReadoutKey, isHatchRibbonVisibilityKey } from './bridge/hatch-command-keys';
import { isThermalSpaceRibbonNumberKey, isThermalSpaceRibbonStringKey } from './bridge/thermal-space-command-keys';
import { isColumnRibbonKey, isColumnRibbonStringKey, isColumnFinishKey, isColumnStructuralKey, isColumnStructuralReadoutKey } from './bridge/column-command-keys';
import { isStoreyRibbonKey } from './bridge/storey-command-keys';
import { getStoreyComboboxState, applyStoreyComboboxChange } from './bridge/storey-height-bridge';
import { isBeamRibbonKey, isBeamRibbonStringKey, isBeamFinishKey } from './bridge/beam-command-keys';
import { isFoundationRibbonKey, isFoundationRibbonStringKey, isFoundationBadgeKey } from './bridge/foundation-command-keys';
import { isSlabOpeningRibbonStringKey } from './bridge/slab-opening-command-keys';
import { isLineToolRibbonKey } from './bridge/line-tool-command-keys';
import { isXlineRibbonKey } from './bridge/xline-command-keys';
import { routeRibbonAction } from './useRibbonCommands-action';
import { useActiveStoreyContext } from '../../../systems/levels/useActiveStoreySync';
import { isCommandRecommendedForStorey } from './bridge/storey-tool-gating';

export type { UseRibbonCommandsProps };

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
  wallCoveringBridge,
  hatchBridge,
  thermalSpaceBridge,
  columnBridge,
  beamBridge,
  foundationBridge,
  slabOpeningBridge,
  mepCircuitBridge,
  mepPipeNetworkBridge,
  waterAutoSupplyBridge,
  drainageAutoBridge,
  heatingAutoBridge,
  electricalAutoBridge,
  electricalWeakAutoBridge,
  hvacAutoBridge,
  fireAutoBridge,
  gasAutoBridge,
  clashDetectionBridge,
  mepFixtureBridge,
  mepManifoldBridge,
  electricalPanelBridge,
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

  // ADR-461 Phase C4 / ADR-467 — active storey context drives the Revit-style
  // ADVISORY tool recommendation (foundation level → foundation/beam/slab; the
  // foundation discipline is graduated by storey, needing `isLowestOccupiedStorey`).
  const activeStorey = useActiveStoreyContext() ?? null;

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
      if (isWallCoveringRibbonNumberKey(key) || isWallCoveringRibbonStringKey(key)) {
        wallCoveringBridge.onComboboxChange(key, value);
        return;
      }
      if (isHatchRibbonNumberKey(key) || isHatchRibbonStringKey(key)) {
        hatchBridge.onComboboxChange(key, value);
        return;
      }
      if (isThermalSpaceRibbonNumberKey(key) || isThermalSpaceRibbonStringKey(key)) {
        thermalSpaceBridge.onComboboxChange(key, value);
        return;
      }
      // ADR-449 Slice 5 fix — finish keys (`column.params.finish.*`) πρέπει να δρομολογηθούν
      // ΚΑΙ εδώ στον columnBridge (το bridge τα χειριζόταν, αλλά ο composer τα ξεχνούσε →
      // έπεφταν στον textEditorBridge → no-op· γι' αυτό το «Σοβάς Ναι/Όχι» δεν άλλαζε).
      // ADR-451 Slice 4 — «Ύψος Ορόφου»: γράφει floor.height του ενεργού ορόφου (ΟΧΙ column param).
      if (isStoreyRibbonKey(key)) {
        applyStoreyComboboxChange(key, value);
        return;
      }
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key) || isColumnFinishKey(key) || isColumnStructuralKey(key)) {
        columnBridge.onComboboxChange(key, value);
        return;
      }
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key) || isBeamFinishKey(key)) {
        beamBridge.onComboboxChange(key, value);
        return;
      }
      if (isFoundationRibbonKey(key) || isFoundationRibbonStringKey(key)) {
        foundationBridge.onComboboxChange(key, value);
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
      if (isElectricalPanelRibbonKey(key)) {
        electricalPanelBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepRadiatorRibbonKey(key) || isMepRadiatorRibbonStringKey(key)) {
        mepRadiatorBridge.onComboboxChange(key, value);
        return;
      }
      if (isMepBoilerRibbonKey(key) || isMepBoilerRibbonStringKey(key)) {
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
    [stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge, thermalSpaceBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
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
      if (isWallCoveringRibbonNumberKey(key) || isWallCoveringRibbonStringKey(key)) return wallCoveringBridge.getComboboxState(key);
      if (isHatchRibbonNumberKey(key) || isHatchRibbonStringKey(key) || isHatchRibbonReadoutKey(key)) return hatchBridge.getComboboxState(key);
      if (isThermalSpaceRibbonNumberKey(key) || isThermalSpaceRibbonStringKey(key)) return thermalSpaceBridge.getComboboxState(key);
      // ADR-449 Slice 5 fix — finish keys δρομολογούνται ΚΑΙ εδώ (αλλιώς το combobox δείχνει
      // «-»: ο composer τα έστελνε στον textEditorBridge → null → δεν διάβαζε την τιμή του σοβά).
      if (isStoreyRibbonKey(key)) return getStoreyComboboxState(key);
      if (isColumnRibbonKey(key) || isColumnRibbonStringKey(key) || isColumnFinishKey(key) || isColumnStructuralKey(key) || isColumnStructuralReadoutKey(key)) return columnBridge.getComboboxState(key);
      if (isBeamRibbonKey(key) || isBeamRibbonStringKey(key) || isBeamFinishKey(key)) return beamBridge.getComboboxState(key);
      if (isFoundationRibbonKey(key) || isFoundationRibbonStringKey(key)) return foundationBridge.getComboboxState(key);
      if (isSlabOpeningRibbonStringKey(key)) return slabOpeningBridge.getComboboxState(key);
      if (isMepFixtureRibbonKey(key) || isMepFixtureRibbonStringKey(key)) return mepFixtureBridge.getComboboxState(key);
      if (isMepManifoldRibbonKey(key) || isMepManifoldClassificationKey(key)) return mepManifoldBridge.getComboboxState(key);
      if (isElectricalPanelRibbonKey(key)) return electricalPanelBridge.getComboboxState(key);
      if (isMepRadiatorRibbonKey(key) || isMepRadiatorRibbonStringKey(key) || isMepRadiatorRibbonReadoutKey(key)) return mepRadiatorBridge.getComboboxState(key);
      if (isMepBoilerRibbonKey(key) || isMepBoilerRibbonStringKey(key) || isMepBoilerReadoutKey(key)) return mepBoilerBridge.getComboboxState(key);
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
    [snapStepUnits, stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge, thermalSpaceBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, arrayBridge, lineToolBridge, xlineModeBridge, textEditorBridge],
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
      if (isMepBoilerToggleKey(key)) {
        mepBoilerBridge.onToggle(key, next);
        return;
      }
      if (isHatchRibbonToggleKey(key)) {
        hatchBridge.onToggle(key, next);
        return;
      }
      textEditorBridge.onToggle(key, next);
    },
    [wallBridge, arrayBridge, openingBridge, roofBridge, mepBoilerBridge, hatchBridge, textEditorBridge],
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (key === 'animation.snap-toggle') return snapEnabled;
      if (isWallRibbonToggleKey(key)) return wallBridge.getToggleState(key);
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      if (isOpeningTagStyleToggleKey(key)) return openingBridge.getToggleState(key);
      if (isRoofRibbonToggleKey(key)) return roofBridge.getToggleState(key);
      if (isMepBoilerToggleKey(key)) return mepBoilerBridge.getToggleState(key);
      if (isHatchRibbonToggleKey(key)) return hatchBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [snapEnabled, wallBridge, arrayBridge, openingBridge, roofBridge, mepBoilerBridge, hatchBridge, textEditorBridge],
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
      if (isFoundationBadgeKey(badgeKey)) return foundationBridge.getBadgeState(badgeKey);
      if (isSlabOpeningBadgeKey(badgeKey)) return slabOpeningBridge.getBadgeState(badgeKey);
      return false;
    },
    [stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge],
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
      if (isSlabPanelVisibilityKey(visibilityKey)) return slabBridge.getPanelVisibility(visibilityKey);
      if (isMepFixturePanelVisibilityKey(visibilityKey)) return mepFixtureBridge.getPanelVisibility(visibilityKey);
      if (isMepManifoldPanelVisibilityKey(visibilityKey)) return mepManifoldBridge.getPanelVisibility(visibilityKey);
      if (isElectricalPanelPanelVisibilityKey(visibilityKey)) return electricalPanelBridge.getPanelVisibility(visibilityKey);
      if (isMepBoilerPanelVisibilityKey(visibilityKey)) return mepBoilerBridge.getPanelVisibility(visibilityKey);
      if (isMepWaterHeaterPanelVisibilityKey(visibilityKey)) return mepWaterHeaterBridge.getPanelVisibility(visibilityKey);
      if (isMepUnderfloorPanelVisibilityKey(visibilityKey)) return mepUnderfloorBridge.getPanelVisibility(visibilityKey);
      if (isMepSegmentPanelVisibilityKey(visibilityKey)) return mepSegmentBridge.getPanelVisibility(visibilityKey);
      if (isFurniturePanelVisibilityKey(visibilityKey)) return furnitureBridge.getPanelVisibility(visibilityKey);
      if (isFloorplanSymbolPanelVisibilityKey(visibilityKey)) return floorplanSymbolBridge.getPanelVisibility(visibilityKey);
      if (isHatchRibbonVisibilityKey(visibilityKey)) return hatchBridge.getPanelVisibility(visibilityKey);
      return true;
    },
    [stairBridge, columnBridge, beamBridge, slabBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, hatchBridge],
  );

  // ADR-461 Phase C4 / ADR-467 — Revit-style advisory recommendation per active
  // storey. Null storey → always `true` (handled inside the pure SSoT) → no change.
  const getCommandRecommendation = React.useCallback(
    (commandKey: string): boolean => isCommandRecommendedForStorey(commandKey, activeStorey),
    [activeStorey],
  );

  // ADR-363 Phase 1E — Wall action keys (delete) handled by bridge before
  // falling through to the generic DxfViewerContent action handler.
  const onAction = React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      routeRibbonAction(action, data, {
        wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge,
        thermalSpaceBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge,
        stairBridge, mepCircuitBridge, mepPipeNetworkBridge, waterAutoSupplyBridge,
        drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge,
        hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, mepFixtureBridge,
        mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge,
        mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge,
        wrappedHandleAction,
      });
    },
    [wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge, thermalSpaceBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge, stairBridge, mepCircuitBridge, mepPipeNetworkBridge, waterAutoSupplyBridge, drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge, hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, wrappedHandleAction],
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
      getCommandRecommendation,
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
      getCommandRecommendation,
    ],
  );
}
