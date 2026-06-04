'use client';
/**
 * 🏢 ENTERPRISE: useSpecialTools Hook
 *
 * @description Manages special entity creation tools (CircleTTT, LinePerpendicular, LineParallel)
 * @see ADR-XXX: CanvasSection Decomposition
 *
 * Responsibilities:
 * - Initialize and manage Circle TTT tool state
 * - Initialize and manage Line Perpendicular tool state
 * - Initialize and manage Line Parallel tool state
 * - Auto-activate/deactivate based on activeTool
 *
 * Pattern: Single Responsibility Principle - Tool Management
 * Extracted from: CanvasSection.tsx
 */
import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { clearAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { clearAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { useStairTool } from '../drawing/useStairTool';
import { useWallTool } from '../drawing/useWallTool';
import { useOpeningTool } from '../drawing/useOpeningTool';
import { useSlabTool, SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useSlabTool';
import { useRoofTool, ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useRoofTool';
import { useColumnTool } from '../drawing/useColumnTool';
import { useMepFixtureTool } from '../drawing/useMepFixtureTool';
import { useFurnitureTool } from '../drawing/useFurnitureTool';
import { useFloorplanSymbolTool } from '../drawing/useFloorplanSymbolTool';
import { useElectricalPanelTool } from '../drawing/useElectricalPanelTool';
import { useMepManifoldTool } from '../drawing/useMepManifoldTool';
import { useMepSegmentTool } from '../drawing/useMepSegmentTool';
import { useRailingTool } from '../drawing/useRailingTool';
import { useBeamTool } from '../drawing/useBeamTool';
import { useSlabOpeningTool } from '../drawing/useSlabOpeningTool';
import { buildSlabOpeningResolvers } from './useSpecialTools-slab-opening';
import { useWallRetrimEffect } from './useSpecialTools-wall-retrim';
import { buildOpeningResolvers } from './useSpecialTools-opening';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
import { useFloorMetadata } from '../data/useFloorMetadata';
import type { StairFloorLinkInput } from '../drawing/stair-completion';
import { useSpecialToolsSelectionTools, type SelectionToolsReturn } from './useSpecialTools-selection-tools';
import { addWallToScene } from '../../bim/walls/add-wall-to-scene';
import { addColumnToScene } from '../../bim/columns/add-column-to-scene';
import { addMepFixtureToScene } from '../../bim/mep-fixtures/add-mep-fixture-to-scene';
import { addFurnitureToScene } from '../../bim/furniture/add-furniture-to-scene';
import { addFloorplanSymbolToScene } from '../../bim/floorplan-symbols/add-floorplan-symbol-to-scene';
import { addElectricalPanelToScene } from '../../bim/electrical-panels/add-electrical-panel-to-scene';
import { addMepManifoldToScene } from '../../bim/mep-manifolds/add-mep-manifold-to-scene';
import { addMepSegmentToScene } from '../../bim/mep-segments/add-mep-segment-to-scene';
import { DEFAULT_DRAINAGE_SLOPE_PERCENT } from '../../bim/types/mep-segment-types';
import { addRailingToScene } from '../../bim/railings/add-railing-to-scene';
// ADR-397 — slab / roof / beam draw delegate to the `appendEntityToScene` SSoT.
// Column draw + Ctrl-copy go through `addColumnToScene` (same SSoT, 'column' tag).
import { appendEntityToScene } from '../../bim/scene/append-entity-to-scene';
// 🏢 ENTERPRISE: Import actual level system types for type safety
import type { LevelsHookReturn } from '../../systems/levels';

// TYPES & INTERFACES
/**
 * Props for useSpecialTools hook
 */
export interface UseSpecialToolsProps {
  /** Current active tool */
  activeTool: string;
  /** Level manager for scene access - uses actual LevelsHookReturn type */
  levelManager: LevelsHookReturn;
}
/**
 * Return type of useSpecialTools hook
 * Uses ReturnType to automatically match the actual hook return types
 */
export interface UseSpecialToolsReturn extends SelectionToolsReturn {
  // SelectionToolsReturn provides: circleTTT, linePerpendicular, lineParallel,
  // angleEntityMeasurement (extracted to useSpecialTools-selection-tools.ts).
  stairTool: ReturnType<typeof useStairTool>;
  wallTool: ReturnType<typeof useWallTool>;
  openingTool: ReturnType<typeof useOpeningTool>;
  slabTool: ReturnType<typeof useSlabTool>;
  roofTool: ReturnType<typeof useRoofTool>; // ADR-417
  columnTool: ReturnType<typeof useColumnTool>;
  mepFixtureTool: ReturnType<typeof useMepFixtureTool>; // ADR-406
  furnitureTool: ReturnType<typeof useFurnitureTool>; // ADR-410
  floorplanSymbolTool: ReturnType<typeof useFloorplanSymbolTool>; // ADR-415
  electricalPanelTool: ReturnType<typeof useElectricalPanelTool>; // ADR-408 Φ3
  mepManifoldTool: ReturnType<typeof useMepManifoldTool>; // ADR-408 Φ12
  mepSegmentTool: ReturnType<typeof useMepSegmentTool>; // ADR-408 Φ8
  railingTool: ReturnType<typeof useRailingTool>; // ADR-407
  beamTool: ReturnType<typeof useBeamTool>;
  slabOpeningTool: ReturnType<typeof useSlabOpeningTool>;
}
// HOOK IMPLEMENTATION
/**
 * 🏢 ENTERPRISE: Special entity creation tools hook
 *
 * This hook manages the state and activation of special drawing tools
 * that require entity selection (CircleTTT, LinePerpendicular, LineParallel).
 *
 * @example
 * ```tsx
 * const {
 *   circleTTT,
 *   linePerpendicular,
 *   lineParallel,
 * } = useSpecialTools({
 *   activeTool,
 *   levelManager,
 * });
 * ```
 */
export function useSpecialTools(props: UseSpecialToolsProps): UseSpecialToolsReturn {
  const { activeTool, levelManager } = props;
  // ADR-358 Phase 9 — Q17 floor link source for the stair tool. Any populated
  // `floorId` on the save context activates the bridge; the builder seeds
  // `multiStoryConfig.storyHeight` (mm) from the floor `height` (m) at commit
  // time. Building-level / property-level contexts have no floorId and the
  // builder falls back to Phase 7a behavior (no auto-init).
  const floorIdForStair = levelManager.saveContext?.floorId ?? null;
  const floorForStair = useFloorMetadata(floorIdForStair);

  // Selection-based geometry tools (CircleTTT / LinePerpendicular / LineParallel /
  // AngleEntityMeasurement) — extracted to useSpecialTools-selection-tools.ts (N.7.1).
  const { circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement } =
    useSpecialToolsSelectionTools({ activeTool, levelManager });

  // ADR-358 Phase 5a — STAIR TOOL

  /**
   * Stair drawing tool — 2-click placement (basePoint + direction) + commit.
   * State machine in `useStairTool`. Variant fixed to 'straight' Phase 5a;
   * contextual ribbon variant selector lands Phase 7a.
   */
  const stairTool = useStairTool({
    currentLevelId: levelManager.currentLevelId || '0',
    // ADR-358 Phase 8 unit-aware builder — convert mm defaults into the active
    // scene's coordinate units so the stair geometry matches the host DXF.
    // `resolveSceneUnits` (utils/scene-units SSoT) prefers the real
    // `$INSUNITS`-propagated `scene.units` and falls back to the bounds
    // heuristic for legacy / unitless scenes.
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    // ADR-358 Phase 9 — Q17 floor link bridge. Returns a snapshot of the
    // floor in scope so the stair builder seeds `multiStoryConfig`.
    getFloorLink: (): StairFloorLinkInput | null => {
      if (!floorForStair) return null;
      return {
        floorId: floorForStair.id,
        name: floorForStair.name,
        height: floorForStair.height,
      };
    },
    onStairCreated: (stairEntity) => {
      // ADR-358 Phase 9C — stamp floorId + buildingId so Firestore persistence
      // can link the stair to its floor (required for Plan B batch update).
      const enriched = floorIdForStair
        ? { ...stairEntity, floorId: floorIdForStair, buildingId: floorForStair?.buildingId }
        : stairEntity;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), enriched],
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('[StairTool] Stair added to scene:', enriched.id);
      // ADR-358 Phase Q17 9B-6 — broadcast creation so persistence layer
      // can immediately schedule the Firestore save. Without this, a freshly
      // drawn stair is local-only until the user explicitly selects + edits
      // it, and a Firestore snapshot in between drops it from the scene
      // (see useStairPersistence diff-merge guard).
      EventBus.emit('drawing:entity-created', {
        entity: enriched,
        tool: 'stair',
      });
    },
  });

  useToolLifecycle(activeTool === 'stair', stairTool.activate, stairTool.deactivate);
  // ADR-363 Phase 1B — WALL TOOL
  /**
   * Wall drawing tool — 2-click placement (startPoint → endPoint) + commit.
   * State machine in `useWallTool`. Default kind = 'straight' (Phase 1B);
   * curved + polyline land Phase 1.5. Continuous draw (chains walls back-to-
   * back, ESC returns to 'select'). The created `WallEntity` is appended to
   * the scene AND broadcast via `EventBus` so `useWallPersistence` can
   * schedule the first Firestore save without waiting for user selection.
   */
  const wallTool = useWallTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    // ADR-363 Phase 1J — live scene entities for the on-entity placement mode
    // (hit-test of existing 2D lines/rectangles under the click).
    getSceneEntities: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return [];
      return levelManager.getLevelScene(levelId)?.entities ?? [];
    },
    // ADR-363 Phase 1G.4 — append + trim + broadcast via the shared SSoT
    // (`addWallToScene`) so the DRAW path and the Ctrl-COPY hot-grip path use
    // ONE insertion routine (N.0.2 — no copy-paste of the persistence trigger).
    onWallCreated: (wallEntity) => addWallToScene(wallEntity, levelManager),
  });
  // ADR-363 Phase 1J — both the freehand wall tool ('wall') and the on-entity
  // variant ('wall-on-entity') share ONE useWallTool instance; lifecycle covers
  // both ids and the placement mode is driven by the active tool id.
  // ADR-363 Phase 1J/1K — the freehand wall ('wall'), the on-entity variant
  // ('wall-on-entity') and the in-region variant ('wall-in-region') all share
  // ONE useWallTool instance; the placement mode is driven by the active tool id.
  const isWallTool =
    activeTool === 'wall' ||
    activeTool === 'wall-on-entity' ||
    activeTool === 'wall-in-region' ||
    activeTool === 'wall-from-perimeter';
  useToolLifecycle(isWallTool, wallTool.activate, wallTool.deactivate);
  useEffect(() => {
    if (activeTool === 'wall') wallTool.setPlacementMode('freehand');
    else if (activeTool === 'wall-on-entity') wallTool.setPlacementMode('on-entity');
    else if (activeTool === 'wall-in-region') wallTool.setPlacementMode('in-region');
    else if (activeTool === 'wall-from-perimeter') wallTool.setPlacementMode('outer-perimeter');
  }, [activeTool, wallTool.setPlacementMode]);
  // ADR-363 Phase 2 — OPENING TOOL (resolvers extracted: useSpecialTools-opening.ts)
  const openingTool = useOpeningTool(buildOpeningResolvers(levelManager));
  useToolLifecycle(activeTool === 'opening', openingTool.activate, openingTool.deactivate);
  // ADR-363 Phase 3 — SLAB TOOL
  /**
   * Slab drawing tool — polygon N-click + Enter (or auto-close near first vertex).
   * State machine in `useSlabTool`. Default kind = 'floor'. Continuous chain.
   * The created `SlabEntity` is appended to the scene AND broadcast via
   * `EventBus` so `useSlabPersistence` can schedule the first Firestore save.
   */
  const slabTool = useSlabTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getAutoCloseTolerance: () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      const units = scene ? resolveSceneUnits(scene) : 'mm';
      return SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT * mmToSceneUnits(units);
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onSlabCreated: (slabEntity) => appendEntityToScene(levelManager, slabEntity, 'slab'),
  });
  useToolLifecycle(activeTool === 'slab', slabTool.activate, slabTool.deactivate);
  // ADR-417 — ROOF TOOL: footprint polygon N-click + Enter (mirror slab). The
  // created `RoofEntity` is appended + broadcast so `RoofPersistenceHost` saves it.
  const roofTool = useRoofTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getAutoCloseTolerance: () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      const units = scene ? resolveSceneUnits(scene) : 'mm';
      return ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT * mmToSceneUnits(units);
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onRoofCreated: (roofEntity) => appendEntityToScene(levelManager, roofEntity, 'roof'),
  });
  useToolLifecycle(activeTool === 'roof', roofTool.activate, roofTool.deactivate);
  // ADR-363 Phase 4 — COLUMN TOOL
  /**
   * Column drawing tool — single-click placement με 9-position anchor + Tab
   * cycling + free rotation. State machine in `useColumnTool`. Continuous chain.
   * The created `ColumnEntity` is appended to the scene AND broadcast via
   * `EventBus` so `useColumnPersistence` can schedule the first Firestore save.
   */
  const columnTool = useColumnTool({
    currentLevelId: levelManager.currentLevelId || '0',
    // ADR-397 — append + broadcast via the shared SSoT (`addColumnToScene`) so
    // the DRAW path and the Ctrl-COPY hot-grip path use ONE insertion routine.
    onColumnCreated: (columnEntity) => addColumnToScene(columnEntity, levelManager),
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    // ADR-363 Φάση 3 — live scene entities για το «Τοιχίο από περίγραμμα» (ανάλυση
    // των παρειών στο box-select / click-inside).
    getSceneEntities: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return [];
      return levelManager.getLevelScene(levelId)?.entities ?? [];
    },
  });
  // ADR-363 Φ3/3c — freehand + «από περίγραμμα» (outer/discrete) μοιράζονται ΕΝΑ
  // useColumnTool· το placement mode οδηγείται από το active tool id.
  const isColumnTool =
    activeTool === 'column' || activeTool === 'column-from-perimeter' || activeTool === 'column-discrete-from-perimeter';
  useToolLifecycle(isColumnTool, columnTool.activate, columnTool.deactivate);
  useEffect(() => {
    if (activeTool === 'column') columnTool.setPlacementMode('freehand');
    else if (activeTool === 'column-from-perimeter') columnTool.setPlacementMode('outer-perimeter');
    else if (activeTool === 'column-discrete-from-perimeter')
      columnTool.setPlacementMode('discrete-perimeter');
  }, [activeTool, columnTool.setPlacementMode]);
  // ADR-406 — MEP FIXTURE TOOL: single-click placement; entity appended+broadcast.
  const mepFixtureTool = useMepFixtureTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onMepFixtureCreated: (fixtureEntity) => addMepFixtureToScene(fixtureEntity, levelManager),
    getSceneUnits: () => {
      const lid = levelManager.currentLevelId;
      return lid ? resolveSceneUnits(levelManager.getLevelScene(lid)) : 'mm';
    },
  });
  useToolLifecycle(activeTool === 'mep-fixture', mepFixtureTool.activate, mepFixtureTool.deactivate);

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
      mepSegmentTool.setParamOverrides({ classification: undefined, slopePercent: undefined });
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

  // ============================================================================
  // ADR-363 Phase 5 — BEAM TOOL
  // ============================================================================
  /**
   * Beam drawing tool — 2-click (straight/cantilever) ή 3-click (curved).
   * State machine in `useBeamTool`. Continuous chain. The created `BeamEntity`
   * is appended to the scene AND broadcast via `EventBus` so
   * `useBeamPersistence` can schedule the first Firestore save.
   */
  const beamTool = useBeamTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    // ADR-363 «Δοκάρι από τοίχο» — live scene entities for the from-wall pick.
    getSceneEntities: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return [];
      return levelManager.getLevelScene(levelId)?.entities ?? [];
    },
    onBeamCreated: (beamEntity) => appendEntityToScene(levelManager, beamEntity, 'beam'),
  });
  // ADR-363 — the freehand beam ('beam') and the from-wall variant
  // ('beam-from-wall') share ONE useBeamTool instance; placement mode follows
  // the active tool id. Creating the beam broadcasts `drawing:entity-created`,
  // so `useStructuralAutoAttach` (ADR-401 D) auto-attaches the wall top.
  const isBeamTool = activeTool === 'beam' || activeTool === 'beam-from-wall';
  useToolLifecycle(isBeamTool, beamTool.activate, beamTool.deactivate);
  useEffect(() => {
    if (activeTool === 'beam') beamTool.setPlacementMode('freehand');
    else if (activeTool === 'beam-from-wall') beamTool.setPlacementMode('from-wall');
  }, [activeTool, beamTool.setPlacementMode]);
  // ADR-363 Phase 3.7 — SLAB-OPENING TOOL (resolvers extracted: useSpecialTools-slab-opening.ts)
  const slabOpeningTool = useSlabOpeningTool(buildSlabOpeningResolvers(levelManager));
  useToolLifecycle(activeTool === 'slab-opening', slabOpeningTool.activate, slabOpeningTool.deactivate);
  // ADR-363 Phase 1E — Re-trim all walls after a grip commit settles (extracted helper).
  useWallRetrimEffect(levelManager);
  // AUTO AREA — clear result panel when tool changes away
  useEffect(() => {
    if (activeTool !== 'auto-measure-area') {
      clearAutoAreaState();
      clearAutoAreaPreview();
    }
  }, [activeTool]);
  // RETURN
  return {
    circleTTT,
    linePerpendicular,
    lineParallel,
    angleEntityMeasurement,
    stairTool,
    wallTool,
    openingTool,
    slabTool,
    roofTool,
    columnTool,
    mepFixtureTool,
    furnitureTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepSegmentTool,
    railingTool,
    beamTool,
    slabOpeningTool,
  };
}
export default useSpecialTools;
