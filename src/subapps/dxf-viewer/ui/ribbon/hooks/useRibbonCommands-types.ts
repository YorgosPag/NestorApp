/**
 * useRibbonCommands — PROPS TYPE
 *
 * Type declaration for the `useRibbonCommands` hook props. Extracted from
 * `useRibbonCommands.ts` (pure type defs aggregating every ribbon bridge) so
 * the hook stays under the 500-line limit. The bridge type imports live here
 * because they are referenced only by this interface.
 *
 * @module ui/ribbon/hooks/useRibbonCommands-types
 */

import type { ToolType } from '../../toolbar/types';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import type { RibbonTextEditorBridge } from './useRibbonTextEditorBridge';
import type { RibbonArrayBridge } from './useRibbonArrayBridge';
import type { RibbonStairBridge } from '../../../bim/hooks/use-ribbon-stair-bridge';
import type { RibbonWallBridge } from './useRibbonWallBridge';
import type { RibbonOpeningBridge } from './useRibbonOpeningBridge';
import type { RibbonSlabBridge } from './useRibbonSlabBridge';
import type { RibbonRoofBridge } from './useRibbonRoofBridge';
import type { RibbonColumnBridge } from './useRibbonColumnBridge';
import type { RibbonBeamBridge } from './useRibbonBeamBridge';
import type { RibbonFoundationBridge } from './useRibbonFoundationBridge';
import type { RibbonSlabOpeningBridge } from './useRibbonSlabOpeningBridge';
import type { RibbonMepCircuitBridge } from './useRibbonMepCircuitBridge';
import type { RibbonMepPipeNetworkBridge } from './useRibbonMepPipeNetworkBridge';
import type { RibbonWaterAutoSupplyBridge } from './useRibbonWaterAutoSupplyBridge';
import type { RibbonDrainageAutoBridge } from './useRibbonDrainageAutoBridge';
import type { RibbonHeatingAutoBridge } from './useRibbonHeatingAutoBridge';
import type { RibbonElectricalAutoBridge } from './useRibbonElectricalAutoBridge';
import type { RibbonElectricalWeakAutoBridge } from './useRibbonElectricalWeakAutoBridge';
import type { RibbonHvacAutoBridge } from './useRibbonHvacAutoBridge';
import type { RibbonFireAutoBridge } from './useRibbonFireAutoBridge';
import type { RibbonGasAutoBridge } from './useRibbonGasAutoBridge';
import type { RibbonClashDetectionBridge } from './useRibbonClashDetectionBridge';
import type { RibbonMepFixtureBridge } from './useRibbonMepFixtureBridge';
import type { RibbonMepManifoldBridge } from './useRibbonMepManifoldBridge';
import type { RibbonElectricalPanelBridge } from './useRibbonElectricalPanelBridge';
import type { RibbonMepRadiatorBridge } from './useRibbonMepRadiatorBridge';
import type { RibbonMepBoilerBridge } from './useRibbonMepBoilerBridge';
import type { RibbonMepWaterHeaterBridge } from './useRibbonMepWaterHeaterBridge';
import type { RibbonMepUnderfloorBridge } from './useRibbonMepUnderfloorBridge';
import type { RibbonMepSegmentBridge } from './useRibbonMepSegmentBridge';
import type { RibbonFurnitureBridge } from './useRibbonFurnitureBridge';
import type { RibbonFloorplanSymbolBridge } from './useRibbonFloorplanSymbolBridge';
import type { RibbonAnnotationSymbolBridge } from './useRibbonAnnotationSymbolBridge';
import type { RibbonMepFixtureLibraryBridge } from './useRibbonMepFixtureLibraryBridge';
import type { RibbonMepRiserBridge } from './useRibbonMepRiserBridge';
import type { RibbonLineToolBridge } from './useRibbonLineToolBridge';
import type { RibbonDimBridge } from './useRibbonDimBridge';
import type { RibbonFloorFinishBridge } from './useRibbonFloorFinishBridge';
import type { RibbonWallCoveringBridge } from './useRibbonWallCoveringBridge';
import type { RibbonHatchBridge } from './useRibbonHatchBridge';
import type { RibbonThermalSpaceBridge } from './useRibbonThermalSpaceBridge';
import type { RibbonXlineModeBridge } from './useRibbonXlineModeBridge';

export interface UseRibbonCommandsProps {
  activeTool: ToolType | null;
  handleToolChange: (tool: ToolType) => void;
  handleRibbonComingSoon: (label: string) => void;
  wrappedHandleAction: (action: string, data?: RibbonActionPayload) => void;
  /**
   * ADR-363 — central «Κλείσιμο» handler for every contextual tab. Deselects
   * the active entity (`universalSelection.clearAll()`) so the contextual tab
   * disappears. Invoked by `routeRibbonAction` for any `*.action(s).close` key.
   */
  closeContextualTab: () => void;
  canUndo: boolean;
  canRedo: boolean;
  textEditorBridge: RibbonTextEditorBridge;
  arrayBridge: RibbonArrayBridge;
  stairBridge: RibbonStairBridge;
  wallBridge: RibbonWallBridge;
  openingBridge: RibbonOpeningBridge;
  slabBridge: RibbonSlabBridge;
  roofBridge: RibbonRoofBridge;
  floorFinishBridge: RibbonFloorFinishBridge;
  wallCoveringBridge: RibbonWallCoveringBridge;
  hatchBridge: RibbonHatchBridge;
  thermalSpaceBridge: RibbonThermalSpaceBridge;
  columnBridge: RibbonColumnBridge;
  beamBridge: RibbonBeamBridge;
  foundationBridge: RibbonFoundationBridge;
  slabOpeningBridge: RibbonSlabOpeningBridge;
  mepCircuitBridge: RibbonMepCircuitBridge;
  mepPipeNetworkBridge: RibbonMepPipeNetworkBridge;
  waterAutoSupplyBridge: RibbonWaterAutoSupplyBridge;
  drainageAutoBridge: RibbonDrainageAutoBridge;
  heatingAutoBridge: RibbonHeatingAutoBridge;
  electricalAutoBridge: RibbonElectricalAutoBridge;
  electricalWeakAutoBridge: RibbonElectricalWeakAutoBridge;
  hvacAutoBridge: RibbonHvacAutoBridge;
  fireAutoBridge: RibbonFireAutoBridge;
  gasAutoBridge: RibbonGasAutoBridge;
  clashDetectionBridge: RibbonClashDetectionBridge;
  mepFixtureBridge: RibbonMepFixtureBridge;
  mepManifoldBridge: RibbonMepManifoldBridge;
  electricalPanelBridge: RibbonElectricalPanelBridge;
  mepRadiatorBridge: RibbonMepRadiatorBridge;
  mepBoilerBridge: RibbonMepBoilerBridge;
  mepWaterHeaterBridge: RibbonMepWaterHeaterBridge;
  mepUnderfloorBridge: RibbonMepUnderfloorBridge;
  mepSegmentBridge: RibbonMepSegmentBridge;
  furnitureBridge: RibbonFurnitureBridge;
  floorplanSymbolBridge: RibbonFloorplanSymbolBridge;
  annotationSymbolBridge: RibbonAnnotationSymbolBridge;
  mepFixtureLibraryBridge: RibbonMepFixtureLibraryBridge;
  mepRiserBridge: RibbonMepRiserBridge;
  lineToolBridge: RibbonLineToolBridge;
  dimBridge: RibbonDimBridge;
  xlineModeBridge: RibbonXlineModeBridge;
}
