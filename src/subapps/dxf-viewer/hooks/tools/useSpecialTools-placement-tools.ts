'use client';
/**
 * 🏢 ENTERPRISE: useSpecialToolsPlacementTools Hook
 *
 * @description Single-click / 2-click placement tools for MEP + furnishing
 * BIM entities. Extracted from useSpecialTools.ts (N.7.1 — 500-line file limit).
 *
 * Covers: MEP fixture (ADR-406), furniture (ADR-410), floorplan symbol
 * (ADR-415), electrical panel (ADR-408 Φ3), plumbing manifold / drainage
 * collector (ADR-408 Φ12/Φ14), heating radiator (ADR-408 Εύρος Β), heating
 * boiler (ADR-408 Εύρος Β #2), MEP segment duct/pipe/drain-pipe (ADR-408
 * Φ8/Φ14), railing (ADR-407).
 *
 * Pattern: Single Responsibility Principle — placement-tool management.
 */
import { useEffect } from 'react';
import { useMepFixtureTool } from '../drawing/useMepFixtureTool';
import { useFurnitureTool } from '../drawing/useFurnitureTool';
import { useBlockLibraryTool } from '../drawing/useBlockLibraryTool';
import { useTitleBlockTool } from '../drawing/useTitleBlockTool';
import { useFurniturePlanTool } from '../drawing/useFurniturePlanTool';
import { usePeoplePlanTool, useVehiclesPlanTool, usePlantsPlanTool } from '../drawing/entourage-tools';
import { useFloorplanSymbolTool } from '../drawing/useFloorplanSymbolTool';
import { useElectricalPanelTool } from '../drawing/useElectricalPanelTool';
import { useMepManifoldTool } from '../drawing/useMepManifoldTool';
import { useMepRadiatorTool } from '../drawing/useMepRadiatorTool';
import { useMepBoilerTool } from '../drawing/useMepBoilerTool';
import { useMepWaterHeaterTool } from '../drawing/useMepWaterHeaterTool';
import { useMepSegmentTool } from '../drawing/useMepSegmentTool';
import { useMepRiserTool } from '../drawing/useMepRiserTool';
import { useRailingTool } from '../drawing/useRailingTool';
import { useHatchAreaLabelTool } from '../drawing/useHatchAreaLabelTool';
import { useTopoBreaklineTool, useTopoBoundaryTool } from '../drawing/useTopoBreaklineTool';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits } from '../../utils/scene-units';
import { addMepFixtureToScene } from '../../bim/mep-fixtures/add-mep-fixture-to-scene';
import { addFurnitureToScene } from '../../bim/furniture/add-furniture-to-scene';
import { addBlockToScene } from '../../bim/block-library/add-block-to-scene';
import { addFurniturePlanToScene } from '../../bim/furniture-plan/add-furniture-plan-to-scene';
import { addEntourageToScene } from '../../bim/entourage/add-entourage-to-scene';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { addFloorplanSymbolToScene } from '../../bim/floorplan-symbols/add-floorplan-symbol-to-scene';
import { addElectricalPanelToScene } from '../../bim/electrical-panels/add-electrical-panel-to-scene';
import { addMepManifoldToScene } from '../../bim/mep-manifolds/add-mep-manifold-to-scene';
import { addMepRadiatorToScene } from '../../bim/mep-radiators/add-mep-radiator-to-scene';
import { addMepBoilerToScene } from '../../bim/mep-boilers/add-mep-boiler-to-scene';
import { addMepWaterHeaterToScene } from '../../bim/mep-water-heaters/add-mep-water-heater-to-scene';
import { addMepSegmentToScene } from '../../bim/mep-segments/add-mep-segment-to-scene';
import { DEFAULT_DRAINAGE_SLOPE_PERCENT } from '../../bim/types/mep-segment-types';
import { plumbingFixtureToolKind } from '../../bim/mep-fixtures/plumbing-fixture-spec';
import { socketFixtureToolKind } from '../../bim/mep-fixtures/socket-symbol-spec';
import { dataOutletFixtureToolKind } from '../../bim/mep-fixtures/data-outlet-symbol-spec';
import { airTerminalFixtureToolKind } from '../../bim/mep-fixtures/air-terminal-symbol-spec';
import { ahuFixtureToolKind } from '../../bim/mep-fixtures/ahu-symbol-spec';
import { sprinklerFixtureToolKind } from '../../bim/mep-fixtures/sprinkler-symbol-spec';
import { fireRiserFixtureToolKind } from '../../bim/mep-fixtures/fire-riser-symbol-spec';
import { gasMeterFixtureToolKind } from '../../bim/mep-fixtures/gas-meter-symbol-spec';
import { gasCookerFixtureToolKind } from '../../bim/mep-fixtures/gas-cooker-symbol-spec';
import { addRailingToScene } from '../../bim/railings/add-railing-to-scene';
import type { LevelsHookReturn } from '../../systems/levels';

export interface UseSpecialToolsPlacementProps {
  /** Current active tool */
  activeTool: string;
  /** Level manager for scene access */
  levelManager: LevelsHookReturn;
}

export interface PlacementToolsReturn {
  mepFixtureTool: ReturnType<typeof useMepFixtureTool>; // ADR-406
  furnitureTool: ReturnType<typeof useFurnitureTool>; // ADR-410
  blockLibraryTool: ReturnType<typeof useBlockLibraryTool>; // Block Library M1
  titleBlockTool: ReturnType<typeof useTitleBlockTool>; // ADR-651 Φάση Β
  furniturePlanTool: ReturnType<typeof useFurniturePlanTool>; // ADR-654
  peoplePlanTool: ReturnType<typeof usePeoplePlanTool>; // ADR-654 M6
  vehiclesPlanTool: ReturnType<typeof useVehiclesPlanTool>; // ADR-654 M6
  plantsPlanTool: ReturnType<typeof usePlantsPlanTool>; // ADR-654 M7

  floorplanSymbolTool: ReturnType<typeof useFloorplanSymbolTool>; // ADR-415
  electricalPanelTool: ReturnType<typeof useElectricalPanelTool>; // ADR-408 Φ3
  mepManifoldTool: ReturnType<typeof useMepManifoldTool>; // ADR-408 Φ12
  mepRadiatorTool: ReturnType<typeof useMepRadiatorTool>; // ADR-408 Εύρος Β
  mepBoilerTool: ReturnType<typeof useMepBoilerTool>; // ADR-408 Εύρος Β #2
  mepWaterHeaterTool: ReturnType<typeof useMepWaterHeaterTool>; // ADR-408 DHW
  mepSegmentTool: ReturnType<typeof useMepSegmentTool>; // ADR-408 Φ8
  mepRiserTool: ReturnType<typeof useMepRiserTool>; // ADR-408 Φ15
  railingTool: ReturnType<typeof useRailingTool>; // ADR-407
}

/**
 * 🏢 ENTERPRISE: MEP + furnishing placement tools hook.
 *
 * All tools share the same scene-units resolver + lifecycle pattern; the
 * active tool id drives activation and (for manifold / segment) preset
 * selection.
 */
export function useSpecialToolsPlacementTools(
  props: UseSpecialToolsPlacementProps,
): PlacementToolsReturn {
  const { activeTool, levelManager } = props;

  // ADR-406 — MEP FIXTURE TOOL: single-click placement; entity appended+broadcast.
  const mepFixtureTool = useMepFixtureTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepFixtureCreated: (fixtureEntity) => addMepFixtureToScene(fixtureEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  // 'mep-fixture' (electrical luminaire), 'mep-floor-drain' (σιφώνι), the five
  // sanitary terminals ('mep-wc'/'mep-washbasin'/… ADR-408 Φ14) AND the appliances
  // ('mep-washing-machine'/… ADR-408 Δρόμος B) share ONE fixture tool; the active
  // tool id drives the `kind` preset (one tool id per kind, the manifold/segment/
  // floor-drain convention).
  const plumbingKind = plumbingFixtureToolKind(activeTool);
  // ADR-430 — the electrical socket (πρίζα) shares the fixture tool (one tool id per
  // kind), distinct from plumbing/light kinds; its tool id drives the `'socket'` preset.
  const socketKind = socketFixtureToolKind(activeTool);
  // ADR-431 — the data outlet (πρίζα δικτύου / RJ45) likewise shares the fixture tool;
  // its tool id drives the `'data-outlet'` preset (weak-current counterpart of socket).
  const dataOutletKind = dataOutletFixtureToolKind(activeTool);
  // ADR-432 — the HVAC air terminal (στόμιο) + AHU (ΚΚΜ) likewise share the fixture
  // tool; their tool ids drive the `'air-terminal'` / `'ahu'` presets.
  const airTerminalKind = airTerminalFixtureToolKind(activeTool);
  const ahuKind = ahuFixtureToolKind(activeTool);
  // ADR-433 — the fire sprinkler head (καταιονητήρας) + fire riser (στήλη) likewise share
  // the fixture tool; their tool ids drive the `'sprinkler'` / `'fire-riser'` presets.
  const sprinklerKind = sprinklerFixtureToolKind(activeTool);
  const fireRiserKind = fireRiserFixtureToolKind(activeTool);
  // ADR-434 — the gas meter (μετρητής αερίου) source + gas cooker (εστία αερίου) terminal
  // likewise share the fixture tool; their tool ids drive the `'gas-meter'` / `'gas-cooker'` presets.
  const gasMeterKind = gasMeterFixtureToolKind(activeTool);
  const gasCookerKind = gasCookerFixtureToolKind(activeTool);
  const isMepFixtureTool =
    activeTool === 'mep-fixture' ||
    activeTool === 'mep-floor-drain' ||
    plumbingKind !== null ||
    socketKind !== null ||
    dataOutletKind !== null ||
    airTerminalKind !== null ||
    ahuKind !== null ||
    sprinklerKind !== null ||
    fireRiserKind !== null ||
    gasMeterKind !== null ||
    gasCookerKind !== null;
  useToolLifecycle(isMepFixtureTool, mepFixtureTool.activate, mepFixtureTool.deactivate);
  useEffect(() => {
    if (activeTool === 'mep-fixture') {
      mepFixtureTool.setParamOverrides({ kind: 'light-fixture' });
    } else if (activeTool === 'mep-floor-drain') {
      mepFixtureTool.setParamOverrides({ kind: 'floor-drain' });
    } else if (plumbingKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: plumbingKind });
    } else if (socketKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: socketKind });
    } else if (dataOutletKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: dataOutletKind });
    } else if (airTerminalKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: airTerminalKind });
    } else if (ahuKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: ahuKind });
    } else if (sprinklerKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: sprinklerKind });
    } else if (fireRiserKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: fireRiserKind });
    } else if (gasMeterKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: gasMeterKind });
    } else if (gasCookerKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: gasCookerKind });
    }
  }, [activeTool, plumbingKind, socketKind, dataOutletKind, airTerminalKind, ahuKind, sprinklerKind, fireRiserKind, gasMeterKind, gasCookerKind, mepFixtureTool.setParamOverrides]);

  // ADR-410 — FURNITURE TOOL: single-click placement; entity appended+broadcast.
  const furnitureTool = useFurnitureTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onFurnitureCreated: (furnitureEntity) => addFurnitureToScene(furnitureEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'furniture', furnitureTool.activate, furnitureTool.deactivate);

  // Block Library M1 — single-click ΕΠΑΝΑτοποθέτηση ενός imported/session block. Το «ποιο block»
  // το ορίζει το palette («Τα Blocks μου») στο block-library-selection-store· εδώ μόνο activate/
  // commit (undoable append+broadcast μέσω addBlockToScene, όπως furniture/mep-fixture).
  const blockLibraryTool = useBlockLibraryTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onBlockCreated: (block) => addBlockToScene(block, levelManager),
  });
  useToolLifecycle(activeTool === 'block-library', blockLibraryTool.activate, blockLibraryTool.deactivate);

  // ADR-651 Φάση Β — ΠΙΝΑΚΙΔΑ: single-click τοποθέτηση του λυμένου title-block ως BlockEntity
  // (ίδιο undoable append+broadcast με το block library). Το ενεργό έργο τροφοδοτεί το
  // zero-config auto-fill· εκτός ProjectHierarchyProvider (ADR-371 read-only preview) το tool
  // δουλεύει κανονικά με κενά πεδία έργου.
  const titleBlockProjectId = useProjectHierarchyOptional()?.selectedProject?.id;
  const titleBlockTool = useTitleBlockTool({
    currentLevelId: levelManager.currentLevelId || '0',
    projectId: titleBlockProjectId,
    onTitleBlockCreated: (block) => addBlockToScene(block, levelManager),
    // ADR-651 Φάση Γ — έξυπνη πρόταση χαρτιού: το bbox του ενεργού σχεδίου (bounds SSoT)
    // ÷ την ενεργή κλίμακα δίνει το προτεινόμενο φύλλο στο όπλισμα του εργαλείου.
    getDrawingEntities: () => {
      const lid = levelManager.currentLevelId;
      return lid ? levelManager.getLevelScene(lid)?.entities ?? [] : [];
    },
  });
  useToolLifecycle(activeTool === 'title-block', titleBlockTool.activate, titleBlockTool.deactivate);

  // ADR-654 — «Έπιπλα κάτοψης» (entourage): single-click τοποθέτηση ImageEntity. Το «ποιο
  // έπιπλο» το ορίζει η παλέτα στο furniture-plan-selection-store· εδώ μόνο activate/commit
  // (undoable append+broadcast μέσω addFurniturePlanToScene, όπως block library/furniture).
  const furniturePlanTool = useFurniturePlanTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onFurnitureCreated: (entity) => addFurniturePlanToScene(entity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'furniture-plan', furniturePlanTool.activate, furniturePlanTool.deactivate);

  // ADR-654 M6 — «Άνθρωποι κάτοψης» (entourage): shared engine, tag 'people-plan'. Το «ποιος
  // άνθρωπος» το ορίζει η παλέτα στο peoplePlanSelection· εδώ μόνο activate/commit.
  const peoplePlanTool = usePeoplePlanTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onEntourageCreated: (entity) => addEntourageToScene(entity, levelManager, 'people-plan'),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'people-plan', peoplePlanTool.activate, peoplePlanTool.deactivate);

  // ADR-654 M6 — «Οχήματα κάτοψης» (entourage): shared engine, tag 'vehicles-plan'.
  const vehiclesPlanTool = useVehiclesPlanTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onEntourageCreated: (entity) => addEntourageToScene(entity, levelManager, 'vehicles-plan'),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'vehicles-plan', vehiclesPlanTool.activate, vehiclesPlanTool.deactivate);

  // ADR-654 M7 — «Φυτά κάτοψης» (entourage): shared engine, tag 'plants-plan'.
  const plantsPlanTool = usePlantsPlanTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onEntourageCreated: (entity) => addEntourageToScene(entity, levelManager, 'plants-plan'),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'plants-plan', plantsPlanTool.activate, plantsPlanTool.deactivate);

  // ADR-415 — FLOORPLAN SYMBOL TOOL: single-click placement; entity appended+broadcast.
  const floorplanSymbolTool = useFloorplanSymbolTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onFloorplanSymbolCreated: (symbolEntity) => addFloorplanSymbolToScene(symbolEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'floorplan-symbol', floorplanSymbolTool.activate, floorplanSymbolTool.deactivate);

  // ADR-408 Φ3 — ELECTRICAL PANEL TOOL: single-click placement; entity appended+broadcast.
  const electricalPanelTool = useElectricalPanelTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onElectricalPanelCreated: (panelEntity) => addElectricalPanelToScene(panelEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  // ADR-408 Φ3 / ADR-431 — the electrical panel (distribution-board) AND the
  // comms-rack (weak-current source) share ONE panel tool; the active tool id drives
  // the `kind` preset (one tool id per kind, the fixture/manifold convention).
  const isElectricalPanelTool = activeTool === 'electrical-panel' || activeTool === 'mep-comms-rack';
  useToolLifecycle(isElectricalPanelTool, electricalPanelTool.activate, electricalPanelTool.deactivate);
  useEffect(() => {
    if (activeTool === 'electrical-panel') {
      electricalPanelTool.setParamOverrides({ kind: 'distribution-board' });
    } else if (activeTool === 'mep-comms-rack') {
      electricalPanelTool.setParamOverrides({ kind: 'comms-rack' });
    }
  }, [activeTool, electricalPanelTool.setParamOverrides]);

  // ADR-408 Φ12 — PLUMBING MANIFOLD TOOL: single-click placement; entity appended+broadcast.
  const mepManifoldTool = useMepManifoldTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepManifoldCreated: (manifoldEntity) => addMepManifoldToScene(manifoldEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  // 'mep-manifold' (water distributor) and 'mep-drainage-collector' (φρεάτιο) share
  // ONE manifold tool; the active tool id drives the `kind` preset (ADR-408 Φ14).
  const isMepManifoldTool =
    activeTool === 'mep-manifold' || activeTool === 'mep-drainage-collector';
  useToolLifecycle(isMepManifoldTool, mepManifoldTool.activate, mepManifoldTool.deactivate);
  useEffect(() => {
    if (activeTool === 'mep-manifold') {
      mepManifoldTool.setParamOverrides({ kind: 'floor-manifold' });
    } else if (activeTool === 'mep-drainage-collector') {
      mepManifoldTool.setParamOverrides({ kind: 'drainage-collector' });
    }
  }, [activeTool, mepManifoldTool.setParamOverrides]);

  // ADR-408 Εύρος Β — HEATING RADIATOR TOOL: single-click placement; entity appended+broadcast.
  const mepRadiatorTool = useMepRadiatorTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepRadiatorCreated: (radiatorEntity) => addMepRadiatorToScene(radiatorEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'mep-radiator', mepRadiatorTool.activate, mepRadiatorTool.deactivate);

  // ADR-408 Εύρος Β #2 — HEATING BOILER TOOL: single-click placement; entity appended+broadcast.
  const mepBoilerTool = useMepBoilerTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepBoilerCreated: (boilerEntity) => addMepBoilerToScene(boilerEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'mep-boiler', mepBoilerTool.activate, mepBoilerTool.deactivate);

  // ADR-408 DHW — WATER HEATER TOOL: single-click placement; entity appended+broadcast.
  const mepWaterHeaterTool = useMepWaterHeaterTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepWaterHeaterCreated: (waterHeaterEntity) => addMepWaterHeaterToScene(waterHeaterEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'mep-water-heater', mepWaterHeaterTool.activate, mepWaterHeaterTool.deactivate);

  // ADR-408 Φ8 — MEP SEGMENT TOOL (duct + pipe): 2-click linear placement.
  const mepSegmentTool = useMepSegmentTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onSegmentCreated: (segmentEntity) => addMepSegmentToScene(segmentEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  // 'mep-duct', 'mep-pipe' and 'mep-drain-pipe' share ONE useMepSegmentTool
  // instance; the domain + drainage preset are driven by the active tool id.
  // ADR-408 Φ14: 'mep-drain-pipe' = a pipe preset with sanitary-drainage
  // classification + a default fall, the Revit "draw under the Sanitary system"
  // gesture. Switching to a non-drainage segment tool CLEARS the preset so a
  // water pipe never inherits the drainage classification/slope.
  const isMepSegmentTool =
    activeTool === 'mep-duct' ||
    activeTool === 'mep-pipe' ||
    activeTool === 'mep-drain-pipe';
  useToolLifecycle(isMepSegmentTool, mepSegmentTool.activate, mepSegmentTool.deactivate);
  useEffect(() => {
    if (activeTool === 'mep-duct') {
      mepSegmentTool.setDomain('duct');
      mepSegmentTool.setParamOverrides({ classification: undefined, slopePercent: undefined });
    } else if (activeTool === 'mep-pipe') {
      mepSegmentTool.setDomain('pipe');
      // ADR-408 Φ14 (draw-time System Type) — a generic pipe is NEVER unclassified
      // (Revit: a System Type always exists). Default to cold water (blue); the user
      // re-picks the system draw-time via the "Σύστημα" ribbon combobox before drawing.
      mepSegmentTool.setParamOverrides({ classification: 'domestic-cold-water', slopePercent: undefined });
    } else if (activeTool === 'mep-drain-pipe') {
      mepSegmentTool.setDomain('pipe');
      mepSegmentTool.setParamOverrides({
        classification: 'sanitary-drainage',
        slopePercent: DEFAULT_DRAINAGE_SLOPE_PERCENT,
      });
    }
  }, [activeTool, mepSegmentTool.setDomain, mepSegmentTool.setParamOverrides]);

  // ADR-407 — RAILING TOOL: 2-click straight guardrail; entity appended+broadcast.
  const railingTool = useRailingTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onRailingCreated: (railingEntity) => addRailingToScene(railingEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'railing', railingTool.activate, railingTool.deactivate);

  // ADR-408 Φ15 — RISER TOOL (κατακόρυφη στήλη αποχέτευσης): single-click vertical
  // drain stack (a vertical mep-segment, base = datum). Entity appended+broadcast.
  const mepRiserTool = useMepRiserTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onRiserCreated: (riserEntity) => addMepSegmentToScene(riserEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'mep-drain-riser', mepRiserTool.activate, mepRiserTool.deactivate);

  // ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης»: lifecycle-only (reset FSM + status hint).
  // Το κλικ το χειρίζεται το `handleHatchAreaLabelClick` πάνω στο vanilla store (ADR-040
  // event-time read), οπότε δεν επιστρέφεται tool object — μόνο activate/deactivate reset.
  useHatchAreaLabelTool(activeTool === 'hatch-area-label');

  // ADR-650 M2-Β — «Γραμμές ασυνέχειας»: lifecycle-only (status hint + hover cleanup).
  // Το κλικ το χειρίζεται το `handleTopoBreaklineClick` πάνω στο vanilla `TopoPointStore`.
  useTopoBreaklineTool(activeTool === 'topo-breakline');

  // ADR-650 M6 (Γ) — «Όριο οικοπέδου»: lifecycle-only (status hint + hover cleanup).
  // Το κλικ το χειρίζεται το `handleTopoBoundaryClick` πάνω στο vanilla `TopoPointStore`.
  useTopoBoundaryTool(activeTool === 'topo-boundary');

  return {
    mepFixtureTool,
    furnitureTool,
    blockLibraryTool,
    titleBlockTool,
    furniturePlanTool,
    peoplePlanTool,
    vehiclesPlanTool,
    plantsPlanTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepWaterHeaterTool,
    mepSegmentTool,
    mepRiserTool,
    railingTool,
  };
}
