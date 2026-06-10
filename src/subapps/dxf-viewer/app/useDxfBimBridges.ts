/**
 * Aggregator hook for BIM contextual ribbon bridges (stair / wall / opening /
 * slab / column / beam). Extracted from DxfViewerContent.tsx to keep that file
 * under the 500-line SRP limit. Each bridge is a thin contextual-tab wire-up.
 */
import { useRibbonStairBridge, type UseRibbonStairBridgeProps } from '../bim/hooks/use-ribbon-stair-bridge';
import { useRibbonWallBridge, type UseRibbonWallBridgeProps } from '../ui/ribbon/hooks/useRibbonWallBridge';
import { useRibbonOpeningBridge, type UseRibbonOpeningBridgeProps } from '../ui/ribbon/hooks/useRibbonOpeningBridge';
import { useRibbonSlabBridge, type UseRibbonSlabBridgeProps } from '../ui/ribbon/hooks/useRibbonSlabBridge';
import { useRibbonRoofBridge, type UseRibbonRoofBridgeProps } from '../ui/ribbon/hooks/useRibbonRoofBridge';
import { useRibbonColumnBridge, type UseRibbonColumnBridgeProps } from '../ui/ribbon/hooks/useRibbonColumnBridge';
import { useRibbonBeamBridge, type UseRibbonBeamBridgeProps } from '../ui/ribbon/hooks/useRibbonBeamBridge';
import { useRibbonFoundationBridge, type UseRibbonFoundationBridgeProps } from '../ui/ribbon/hooks/useRibbonFoundationBridge';
import { useRibbonSlabOpeningBridge, type UseRibbonSlabOpeningBridgeProps } from '../ui/ribbon/hooks/useRibbonSlabOpeningBridge';
import { useRibbonMepCircuitBridge, type UseRibbonMepCircuitBridgeProps } from '../ui/ribbon/hooks/useRibbonMepCircuitBridge';
import { useRibbonMepPipeNetworkBridge } from '../ui/ribbon/hooks/useRibbonMepPipeNetworkBridge';
import { useRibbonMepFixtureBridge, type UseRibbonMepFixtureBridgeProps } from '../ui/ribbon/hooks/useRibbonMepFixtureBridge';
import { useRibbonMepManifoldBridge, type UseRibbonMepManifoldBridgeProps } from '../ui/ribbon/hooks/useRibbonMepManifoldBridge';
import { useRibbonElectricalPanelBridge, type UseRibbonElectricalPanelBridgeProps } from '../ui/ribbon/hooks/useRibbonElectricalPanelBridge';
import { useRibbonMepRadiatorBridge, type UseRibbonMepRadiatorBridgeProps } from '../ui/ribbon/hooks/useRibbonMepRadiatorBridge';
import { useRibbonMepBoilerBridge, type UseRibbonMepBoilerBridgeProps } from '../ui/ribbon/hooks/useRibbonMepBoilerBridge';
import { useRibbonMepWaterHeaterBridge, type UseRibbonMepWaterHeaterBridgeProps } from '../ui/ribbon/hooks/useRibbonMepWaterHeaterBridge';
import { useRibbonMepUnderfloorBridge, type UseRibbonMepUnderfloorBridgeProps } from '../ui/ribbon/hooks/useRibbonMepUnderfloorBridge';
import { useRibbonMepSegmentBridge, type UseRibbonMepSegmentBridgeProps } from '../ui/ribbon/hooks/useRibbonMepSegmentBridge';
import { useRibbonWaterAutoSupplyBridge, type UseRibbonWaterAutoSupplyBridgeProps } from '../ui/ribbon/hooks/useRibbonWaterAutoSupplyBridge';
import { useRibbonDrainageAutoBridge, type UseRibbonDrainageAutoBridgeProps } from '../ui/ribbon/hooks/useRibbonDrainageAutoBridge';
import { useRibbonHeatingAutoBridge, type UseRibbonHeatingAutoBridgeProps } from '../ui/ribbon/hooks/useRibbonHeatingAutoBridge';
import { useRibbonElectricalAutoBridge, type UseRibbonElectricalAutoBridgeProps } from '../ui/ribbon/hooks/useRibbonElectricalAutoBridge';
import { useRibbonElectricalWeakAutoBridge } from '../ui/ribbon/hooks/useRibbonElectricalWeakAutoBridge';
import { useRibbonHvacAutoBridge } from '../ui/ribbon/hooks/useRibbonHvacAutoBridge';
import { useRibbonFireAutoBridge } from '../ui/ribbon/hooks/useRibbonFireAutoBridge';
import { useRibbonGasAutoBridge } from '../ui/ribbon/hooks/useRibbonGasAutoBridge';
import { useRibbonClashDetectionBridge } from '../ui/ribbon/hooks/useRibbonClashDetectionBridge';
import { useRibbonFurnitureBridge } from '../ui/ribbon/hooks/useRibbonFurnitureBridge';
import { useRibbonFloorplanSymbolBridge } from '../ui/ribbon/hooks/useRibbonFloorplanSymbolBridge';
import { useRibbonMepFixtureLibraryBridge } from '../ui/ribbon/hooks/useRibbonMepFixtureLibraryBridge';
import { useRibbonMepRiserBridge } from '../ui/ribbon/hooks/useRibbonMepRiserBridge';
import { useRibbonFloorFinishBridge } from '../ui/ribbon/hooks/useRibbonFloorFinishBridge';
import { useRibbonThermalSpaceBridge } from '../ui/ribbon/hooks/useRibbonThermalSpaceBridge';
import { useBimMaterialCycler } from '../hooks/useBimMaterialCycler';

export type UseDxfBimBridgesProps =
  & UseRibbonStairBridgeProps
  & UseRibbonWallBridgeProps
  & UseRibbonOpeningBridgeProps
  & UseRibbonSlabBridgeProps
  & UseRibbonRoofBridgeProps
  & UseRibbonColumnBridgeProps
  & UseRibbonBeamBridgeProps
  & UseRibbonFoundationBridgeProps
  & UseRibbonSlabOpeningBridgeProps
  & UseRibbonMepCircuitBridgeProps
  & UseRibbonMepFixtureBridgeProps
  & UseRibbonMepManifoldBridgeProps
  & UseRibbonElectricalPanelBridgeProps
  & UseRibbonMepRadiatorBridgeProps
  & UseRibbonMepBoilerBridgeProps
  & UseRibbonMepWaterHeaterBridgeProps
  & UseRibbonMepUnderfloorBridgeProps
  & UseRibbonMepSegmentBridgeProps
  & UseRibbonWaterAutoSupplyBridgeProps
  & UseRibbonDrainageAutoBridgeProps
  & UseRibbonHeatingAutoBridgeProps
  & UseRibbonElectricalAutoBridgeProps;

export function useDxfBimBridges(p: UseDxfBimBridgesProps) {
  const stairBridge = useRibbonStairBridge(p);
  const wallBridge = useRibbonWallBridge(p);
  const openingBridge = useRibbonOpeningBridge(p);
  const slabBridge = useRibbonSlabBridge(p);
  // ADR-417 — roof (κεκλιμένη στέγη) contextual properties bridge.
  const roofBridge = useRibbonRoofBridge(p);
  const columnBridge = useRibbonColumnBridge(p);
  const beamBridge = useRibbonBeamBridge(p);
  // ADR-436 — foundation (θεμελίωση) contextual properties bridge.
  const foundationBridge = useRibbonFoundationBridge(p);
  const slabOpeningBridge = useRibbonSlabOpeningBridge(p);
  // ADR-408 Φ5 — MEP circuit contextual bridge (create-from-selection).
  const mepCircuitBridge = useRibbonMepCircuitBridge(p);
  // ADR-408 Φ13 — MEP pipe-network contextual bridge (manifold + pipes → network).
  const mepPipeNetworkBridge = useRibbonMepPipeNetworkBridge(p);
  // ADR-406 — MEP fixture (φωτιστικό) contextual properties bridge.
  const mepFixtureBridge = useRibbonMepFixtureBridge(p);
  // ADR-408 Φ12 — MEP manifold (συλλέκτης) contextual properties bridge.
  const mepManifoldBridge = useRibbonMepManifoldBridge(p);
  // ADR-408 Φ3/Φ6 — electrical panel (πίνακας) contextual properties bridge
  // (geometry + folded «Κυκλώματα» management).
  const electricalPanelBridge = useRibbonElectricalPanelBridge(p);
  // ADR-408 Εύρος Β — MEP radiator (καλοριφέρ) contextual properties bridge.
  const mepRadiatorBridge = useRibbonMepRadiatorBridge(p);
  // ADR-408 Εύρος Β #2 — MEP boiler (λέβητας) contextual properties bridge.
  const mepBoilerBridge = useRibbonMepBoilerBridge(p);
  // ADR-408 DHW — MEP water heater (θερμοσίφωνας) contextual properties bridge.
  const mepWaterHeaterBridge = useRibbonMepWaterHeaterBridge(p);
  // ADR-408 Εύρος Β #3 — MEP underfloor (ενδοδαπέδια) contextual properties bridge.
  const mepUnderfloorBridge = useRibbonMepUnderfloorBridge(p);
  // ADR-408 Φ8 — MEP segment (σωλήνας/αεραγωγός) contextual properties bridge.
  const mepSegmentBridge = useRibbonMepSegmentBridge(p);
  // ADR-426 Slice 2 — water-supply auto-design (Generate → review → accept).
  const waterAutoSupplyBridge = useRibbonWaterAutoSupplyBridge(p);
  // ADR-427 Slice 2 — sanitary-drainage auto-design (Generate → review → accept).
  const drainageAutoBridge = useRibbonDrainageAutoBridge(p);
  // ADR-428 Slice 2 — heating (hydronic) auto-design (Generate → review → accept).
  const heatingAutoBridge = useRibbonHeatingAutoBridge(p);
  const electricalAutoBridge = useRibbonElectricalAutoBridge(p);
  // ADR-431 Slice 2 — electrical-weak (ασθενή) auto-design (Generate → review → accept).
  const electricalWeakAutoBridge = useRibbonElectricalWeakAutoBridge(p);
  // ADR-432 Slice 2 — HVAC (αερισμός) auto-design (Generate → review → accept).
  const hvacAutoBridge = useRibbonHvacAutoBridge(p);
  // ADR-433 Slice 2 — fire-protection (πυρόσβεση) auto-design (Generate → review → accept).
  const fireAutoBridge = useRibbonFireAutoBridge(p);
  // ADR-434 Slice 2 — gas (φυσικό αέριο) auto-design (Generate → review → accept). 8/8 disciplines.
  const gasAutoBridge = useRibbonGasAutoBridge(p);
  // ADR-435 Slice 1 — clash detection (Coordination, read-only Detect → review → Clear).
  const clashDetectionBridge = useRibbonClashDetectionBridge(p);
  // ADR-410 — furniture library contextual bridge (tool-active picker).
  const furnitureBridge = useRibbonFurnitureBridge();
  // ADR-415 — floorplan-symbol library contextual bridge (tool-active picker).
  const floorplanSymbolBridge = useRibbonFloorplanSymbolBridge();
  // ADR-411 — light-fixture library contextual bridge (tool-active picker).
  const mepFixtureLibraryBridge = useRibbonMepFixtureLibraryBridge();
  // ADR-408 Φ15 Phase-2 — MEP riser (κατακόρυφη στήλη) tool-active bridge.
  const mepRiserBridge = useRibbonMepRiserBridge();
  // ADR-419 — floor finish (IfcCovering FLOORING) contextual properties bridge.
  const floorFinishBridge = useRibbonFloorFinishBridge(p);
  // ADR-422 — thermal space (IfcSpace) contextual properties bridge.
  const thermalSpaceBridge = useRibbonThermalSpaceBridge(p);
  // ADR-363 Phase 4.5e+ — Tab/Shift+Tab material cycling for selected BIM entities.
  useBimMaterialCycler(p);
  return { stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge, mepCircuitBridge, mepPipeNetworkBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, waterAutoSupplyBridge, drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge, hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, floorFinishBridge, thermalSpaceBridge };
}
