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
import { useCircleTTT } from '../drawing/useCircleTTT';
import { clearAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { clearAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { useLinePerpendicular } from '../drawing/useLinePerpendicular';
import { useLineParallel } from '../drawing/useLineParallel';
import { useStairTool } from '../drawing/useStairTool';
import { useWallTool } from '../drawing/useWallTool';
import { useOpeningTool } from '../drawing/useOpeningTool';
import { useSlabTool, SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useSlabTool';
import { useColumnTool } from '../drawing/useColumnTool';
import { useBeamTool } from '../drawing/useBeamTool';
import { useSlabOpeningTool } from '../drawing/useSlabOpeningTool';
import { buildSlabOpeningResolvers } from './useSpecialTools-slab-opening';
import { buildOpeningResolvers } from './useSpecialTools-opening';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
import { useFloorMetadata } from '../data/useFloorMetadata';
import type { StairFloorLinkInput } from '../drawing/stair-completion';
import { useAngleEntityMeasurement, type AngleEntityVariant } from './useAngleEntityMeasurement';
import type { AngleMeasurementEntity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import { computeWallTrims, applyTrimPatches } from '../../bim/walls/wall-trims';
import { addWallToScene } from '../../bim/walls/add-wall-to-scene';
import { addColumnToScene } from '../../bim/columns/add-column-to-scene';
import { appendEntityToScene } from '../../bim/scene/append-entity-to-scene';
// 🏢 ENTERPRISE: Import actual level system types for type safety
import type { LevelsHookReturn } from '../../systems/levels';

// ADR-397 — delegates to the `appendEntityToScene` SSoT (slab / beam draw).
// Column draw + Ctrl-copy go through `addColumnToScene` (same SSoT, 'column' tag).
function appendAndBroadcast<E extends { id: string }>(
  levelManager: LevelsHookReturn,
  entity: E,
  tool: string,
): void {
  appendEntityToScene(levelManager, entity, tool);
}
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
export interface UseSpecialToolsReturn {
  /** Circle TTT hook return */
  circleTTT: ReturnType<typeof useCircleTTT>;
  /** Line Perpendicular hook return */
  linePerpendicular: ReturnType<typeof useLinePerpendicular>;
  /** Line Parallel hook return */
  lineParallel: ReturnType<typeof useLineParallel>;
  /** Angle entity measurement hook return */
  angleEntityMeasurement: ReturnType<typeof useAngleEntityMeasurement>;
  /** ADR-358 Phase 5a — Stair tool hook return */
  stairTool: ReturnType<typeof useStairTool>;
  /** ADR-363 Phase 1B — Wall tool hook return */
  wallTool: ReturnType<typeof useWallTool>;
  /** ADR-363 Phase 2 — Opening tool hook return */
  openingTool: ReturnType<typeof useOpeningTool>;
  /** ADR-363 Phase 3 — Slab tool hook return */
  slabTool: ReturnType<typeof useSlabTool>;
  /** ADR-363 Phase 4 — Column tool hook return */
  columnTool: ReturnType<typeof useColumnTool>;
  /** ADR-363 Phase 5 — Beam tool hook return */
  beamTool: ReturnType<typeof useBeamTool>;
  /** ADR-363 Phase 3.7 — Slab-Opening tool hook return */
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
  // CIRCLE TTT TOOL
  /**
   * Circle tangent to 3 lines tool
   */
  const circleTTT = useCircleTTT({
    currentLevelId: levelManager.currentLevelId || '0',
    onCircleCreated: (circleEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), circleEntity]
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('🎯 [CircleTTT] Circle added to scene:', circleEntity.id);
    }
  });

  // Auto-activate/deactivate based on activeTool
  const { activate: activateCircleTTT, deactivate: deactivateCircleTTT } = circleTTT;
  useEffect(() => {
    if (activeTool === 'circle-ttt') {
      activateCircleTTT();
    } else {
      deactivateCircleTTT();
    }
  }, [activeTool, activateCircleTTT, deactivateCircleTTT]);

  // LINE PERPENDICULAR TOOL

  /**
   * Line perpendicular to reference line tool
   */
  const linePerpendicular = useLinePerpendicular({
    currentLevelId: levelManager.currentLevelId || '0',
    onLineCreated: (lineEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), lineEntity]
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('🎯 [LinePerpendicular] Line added to scene:', lineEntity.id);
    }
  });

  // Auto-activate/deactivate based on activeTool
  const { activate: activateLinePerpendicular, deactivate: deactivateLinePerpendicular } = linePerpendicular;
  useEffect(() => {
    if (activeTool === 'line-perpendicular') {
      activateLinePerpendicular();
    } else {
      deactivateLinePerpendicular();
    }
  }, [activeTool, activateLinePerpendicular, deactivateLinePerpendicular]);

  // LINE PARALLEL TOOL

  /**
   * Line parallel to reference line tool
   */
  const lineParallel = useLineParallel({
    currentLevelId: levelManager.currentLevelId || '0',
    onLineCreated: (lineEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), lineEntity]
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('🎯 [LineParallel] Line added to scene:', lineEntity.id);
    }
  });

  // Auto-activate/deactivate based on activeTool
  const { activate: activateLineParallel, deactivate: deactivateLineParallel } = lineParallel;
  useEffect(() => {
    if (activeTool === 'line-parallel') {
      activateLineParallel();
    } else {
      deactivateLineParallel();
    }
  }, [activeTool, activateLineParallel, deactivateLineParallel]);

  // ANGLE ENTITY MEASUREMENT TOOL (constraint, line-arc, two-arcs)

  const angleEntityMeasurement = useAngleEntityMeasurement({
    onMeasurementCreated: (measurementEntity: AngleMeasurementEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), measurementEntity]
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('📐 [AngleEntityMeasurement] Angle added to scene:', measurementEntity.id);
    }
  });

  // Auto-activate/deactivate based on activeTool
  const ANGLE_ENTITY_TOOLS: ReadonlySet<string> = new Set([
    'measure-angle-constraint', 'measure-angle-line-arc', 'measure-angle-two-arcs'
  ]);
  const { activate: activateAngle, deactivate: deactivateAngle } = angleEntityMeasurement;
  useEffect(() => {
    if (ANGLE_ENTITY_TOOLS.has(activeTool)) {
      activateAngle(activeTool as AngleEntityVariant);
    } else {
      deactivateAngle();
    }
  }, [activeTool, activateAngle, deactivateAngle]);

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
    onSlabCreated: (slabEntity) => appendAndBroadcast(levelManager, slabEntity, 'slab'),
  });
  useToolLifecycle(activeTool === 'slab', slabTool.activate, slabTool.deactivate);
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
  // ADR-363 Φάση 3 / 3c — ο freehand column ('column'), το «Τοιχίο από περίγραμμα»
  // ('column-from-perimeter') και η «Κολώνα από περίγραμμα» ('column-discrete-from-
  // perimeter') μοιράζονται ΕΝΑ useColumnTool· το placement mode οδηγείται από το
  // active tool id.
  const isColumnTool =
    activeTool === 'column' ||
    activeTool === 'column-from-perimeter' ||
    activeTool === 'column-discrete-from-perimeter';
  useToolLifecycle(isColumnTool, columnTool.activate, columnTool.deactivate);
  useEffect(() => {
    if (activeTool === 'column') columnTool.setPlacementMode('freehand');
    else if (activeTool === 'column-from-perimeter') columnTool.setPlacementMode('outer-perimeter');
    else if (activeTool === 'column-discrete-from-perimeter')
      columnTool.setPlacementMode('discrete-perimeter');
  }, [activeTool, columnTool.setPlacementMode]);
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
    onBeamCreated: (beamEntity) => appendAndBroadcast(levelManager, beamEntity, 'beam'),
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
  // ADR-363 Phase 1E — Re-trim all walls after a grip commit settles (200 ms).
  // Only runs when ≥2 walls exist and at least one bevel is needed.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = EventBus.on('bim:wall-params-updated', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const levelId = levelManager.currentLevelId;
        if (!levelId) return;
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;
        const allWalls = scene.entities.filter(isWallEntity);
        if (allWalls.length < 2) return;
        const trims = computeWallTrims(allWalls);
        if (trims.size === 0) return;
        const patched = applyTrimPatches(scene.entities, trims);
        levelManager.setLevelScene(levelId, { ...scene, entities: patched });
      }, 200);
    });
    return () => {
      cleanup();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [levelManager]);
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
    columnTool,
    beamTool,
    slabOpeningTool,
  };
}
export default useSpecialTools;
