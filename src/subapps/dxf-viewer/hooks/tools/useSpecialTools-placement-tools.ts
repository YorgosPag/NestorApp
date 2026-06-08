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
import { useFloorplanSymbolTool } from '../drawing/useFloorplanSymbolTool';
import { useElectricalPanelTool } from '../drawing/useElectricalPanelTool';
import { useMepManifoldTool } from '../drawing/useMepManifoldTool';
import { useMepRadiatorTool } from '../drawing/useMepRadiatorTool';
import { useMepBoilerTool } from '../drawing/useMepBoilerTool';
import { useMepWaterHeaterTool } from '../drawing/useMepWaterHeaterTool';
import { useMepSegmentTool } from '../drawing/useMepSegmentTool';
import { useMepRiserTool } from '../drawing/useMepRiserTool';
import { useRailingTool } from '../drawing/useRailingTool';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits } from '../../utils/scene-units';
import { addMepFixtureToScene } from '../../bim/mep-fixtures/add-mep-fixture-to-scene';
import { addFurnitureToScene } from '../../bim/furniture/add-furniture-to-scene';
import { addFloorplanSymbolToScene } from '../../bim/floorplan-symbols/add-floorplan-symbol-to-scene';
import { addElectricalPanelToScene } from '../../bim/electrical-panels/add-electrical-panel-to-scene';
import { addMepManifoldToScene } from '../../bim/mep-manifolds/add-mep-manifold-to-scene';
import { addMepRadiatorToScene } from '../../bim/mep-radiators/add-mep-radiator-to-scene';
import { addMepBoilerToScene } from '../../bim/mep-boilers/add-mep-boiler-to-scene';
import { addMepWaterHeaterToScene } from '../../bim/mep-water-heaters/add-mep-water-heater-to-scene';
import { addMepSegmentToScene } from '../../bim/mep-segments/add-mep-segment-to-scene';
import { DEFAULT_DRAINAGE_SLOPE_PERCENT } from '../../bim/types/mep-segment-types';
import { plumbingFixtureToolKind } from '../../bim/mep-fixtures/plumbing-fixture-spec';
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
  const isMepFixtureTool =
    activeTool === 'mep-fixture' || activeTool === 'mep-floor-drain' || plumbingKind !== null;
  useToolLifecycle(isMepFixtureTool, mepFixtureTool.activate, mepFixtureTool.deactivate);
  useEffect(() => {
    if (activeTool === 'mep-fixture') {
      mepFixtureTool.setParamOverrides({ kind: 'light-fixture' });
    } else if (activeTool === 'mep-floor-drain') {
      mepFixtureTool.setParamOverrides({ kind: 'floor-drain' });
    } else if (plumbingKind !== null) {
      mepFixtureTool.setParamOverrides({ kind: plumbingKind });
    }
  }, [activeTool, plumbingKind, mepFixtureTool.setParamOverrides]);

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
  useToolLifecycle(activeTool === 'electrical-panel', electricalPanelTool.activate, electricalPanelTool.deactivate);

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

  return {
    mepFixtureTool,
    furnitureTool,
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
