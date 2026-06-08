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
import { useRibbonSlabOpeningBridge, type UseRibbonSlabOpeningBridgeProps } from '../ui/ribbon/hooks/useRibbonSlabOpeningBridge';
import { useRibbonMepCircuitBridge, type UseRibbonMepCircuitBridgeProps } from '../ui/ribbon/hooks/useRibbonMepCircuitBridge';
import { useRibbonMepPipeNetworkBridge } from '../ui/ribbon/hooks/useRibbonMepPipeNetworkBridge';
import { useRibbonMepFixtureBridge, type UseRibbonMepFixtureBridgeProps } from '../ui/ribbon/hooks/useRibbonMepFixtureBridge';
import { useRibbonMepManifoldBridge, type UseRibbonMepManifoldBridgeProps } from '../ui/ribbon/hooks/useRibbonMepManifoldBridge';
import { useRibbonMepRadiatorBridge, type UseRibbonMepRadiatorBridgeProps } from '../ui/ribbon/hooks/useRibbonMepRadiatorBridge';
import { useRibbonMepBoilerBridge, type UseRibbonMepBoilerBridgeProps } from '../ui/ribbon/hooks/useRibbonMepBoilerBridge';
import { useRibbonMepUnderfloorBridge, type UseRibbonMepUnderfloorBridgeProps } from '../ui/ribbon/hooks/useRibbonMepUnderfloorBridge';
import { useRibbonMepSegmentBridge, type UseRibbonMepSegmentBridgeProps } from '../ui/ribbon/hooks/useRibbonMepSegmentBridge';
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
  & UseRibbonSlabOpeningBridgeProps
  & UseRibbonMepCircuitBridgeProps
  & UseRibbonMepFixtureBridgeProps
  & UseRibbonMepManifoldBridgeProps
  & UseRibbonMepRadiatorBridgeProps
  & UseRibbonMepBoilerBridgeProps
  & UseRibbonMepUnderfloorBridgeProps
  & UseRibbonMepSegmentBridgeProps;

export function useDxfBimBridges(p: UseDxfBimBridgesProps) {
  const stairBridge = useRibbonStairBridge(p);
  const wallBridge = useRibbonWallBridge(p);
  const openingBridge = useRibbonOpeningBridge(p);
  const slabBridge = useRibbonSlabBridge(p);
  // ADR-417 — roof (κεκλιμένη στέγη) contextual properties bridge.
  const roofBridge = useRibbonRoofBridge(p);
  const columnBridge = useRibbonColumnBridge(p);
  const beamBridge = useRibbonBeamBridge(p);
  const slabOpeningBridge = useRibbonSlabOpeningBridge(p);
  // ADR-408 Φ5 — MEP circuit contextual bridge (create-from-selection).
  const mepCircuitBridge = useRibbonMepCircuitBridge(p);
  // ADR-408 Φ13 — MEP pipe-network contextual bridge (manifold + pipes → network).
  const mepPipeNetworkBridge = useRibbonMepPipeNetworkBridge(p);
  // ADR-406 — MEP fixture (φωτιστικό) contextual properties bridge.
  const mepFixtureBridge = useRibbonMepFixtureBridge(p);
  // ADR-408 Φ12 — MEP manifold (συλλέκτης) contextual properties bridge.
  const mepManifoldBridge = useRibbonMepManifoldBridge(p);
  // ADR-408 Εύρος Β — MEP radiator (καλοριφέρ) contextual properties bridge.
  const mepRadiatorBridge = useRibbonMepRadiatorBridge(p);
  // ADR-408 Εύρος Β #2 — MEP boiler (λέβητας) contextual properties bridge.
  const mepBoilerBridge = useRibbonMepBoilerBridge(p);
  // ADR-408 Εύρος Β #3 — MEP underfloor (ενδοδαπέδια) contextual properties bridge.
  const mepUnderfloorBridge = useRibbonMepUnderfloorBridge(p);
  // ADR-408 Φ8 — MEP segment (σωλήνας/αεραγωγός) contextual properties bridge.
  const mepSegmentBridge = useRibbonMepSegmentBridge(p);
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
  return { stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, columnBridge, beamBridge, slabOpeningBridge, mepCircuitBridge, mepPipeNetworkBridge, mepFixtureBridge, mepManifoldBridge, mepRadiatorBridge, mepBoilerBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, floorplanSymbolBridge, mepFixtureLibraryBridge, mepRiserBridge, floorFinishBridge, thermalSpaceBridge };
}
