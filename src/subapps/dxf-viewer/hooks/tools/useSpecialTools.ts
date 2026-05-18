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
import { useSlabTool } from '../drawing/useSlabTool';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useFloorMetadata } from '../data/useFloorMetadata';
import type { StairFloorLinkInput } from '../drawing/stair-completion';
import { useAngleEntityMeasurement, type AngleEntityVariant } from './useAngleEntityMeasurement';
import type { AngleMeasurementEntity, Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Point2D } from '../../rendering/types/Types';
import { computeWallTrims, applyTrimPatches } from '../../bim/walls/wall-trims';
// 🏢 ENTERPRISE: Import actual level system types for type safety
import type { LevelsHookReturn } from '../../systems/levels';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

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
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

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

  // ============================================================================
  // CIRCLE TTT TOOL
  // ============================================================================

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

  // ============================================================================
  // LINE PERPENDICULAR TOOL
  // ============================================================================

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

  // ============================================================================
  // LINE PARALLEL TOOL
  // ============================================================================

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

  // ============================================================================
  // ANGLE ENTITY MEASUREMENT TOOL (constraint, line-arc, two-arcs)
  // ============================================================================

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

  // ============================================================================
  // ADR-358 Phase 5a — STAIR TOOL
  // ============================================================================

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
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const updatedScene = {
        ...scene,
        entities: [...(scene.entities || []), stairEntity],
      };
      levelManager.setLevelScene(levelId, updatedScene);
      console.debug('[StairTool] Stair added to scene:', stairEntity.id);
      // ADR-358 Phase Q17 9B-6 — broadcast creation so persistence layer
      // can immediately schedule the Firestore save. Without this, a freshly
      // drawn stair is local-only until the user explicitly selects + edits
      // it, and a Firestore snapshot in between drops it from the scene
      // (see useStairPersistence diff-merge guard).
      EventBus.emit('drawing:entity-created', {
        entity: stairEntity,
        tool: 'stair',
      });
    },
  });

  const { activate: activateStair, deactivate: deactivateStair } = stairTool;
  useEffect(() => {
    if (activeTool === 'stair') {
      activateStair();
    } else {
      deactivateStair();
    }
  }, [activeTool, activateStair, deactivateStair]);
  // ============================================================================
  // ADR-363 Phase 1B — WALL TOOL
  // ============================================================================
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
    onWallCreated: (wallEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      // Include new wall before computing trims so neighbors are also patched.
      const entitiesWithNew = [...(scene.entities || []), wallEntity];
      const allWalls = entitiesWithNew.filter(isWallEntity);
      const trims = computeWallTrims(allWalls);
      const patchedEntities = applyTrimPatches(entitiesWithNew, trims);
      levelManager.setLevelScene(levelId, { ...scene, entities: patchedEntities });
      console.debug('[WallTool] Wall added to scene:', wallEntity.id, 'trims:', trims.size);
      // Broadcast with trim-patched entity so persistence layer saves correct params.
      const patchedNewWall = (patchedEntities.find(e => e.id === wallEntity.id) as (typeof wallEntity) | undefined) ?? wallEntity;
      EventBus.emit('drawing:entity-created', { entity: patchedNewWall, tool: 'wall' });
    },
  });
  const { activate: activateWall, deactivate: deactivateWall } = wallTool;
  useEffect(() => {
    if (activeTool === 'wall') {
      activateWall();
    } else {
      deactivateWall();
    }
  }, [activeTool, activateWall, deactivateWall]);
  // ============================================================================
  // ADR-363 Phase 2 — OPENING TOOL
  // ============================================================================
  /**
   * Opening drawing tool — 2-state FSM (await host wall → await position). The
   * created `OpeningEntity` is appended to the scene AND broadcast via
   * `EventBus` so `useOpeningPersistence` can schedule the first Firestore save.
   *
   * Host resolution: `getWallAtPoint` reads the current scene and returns the
   * first wall whose `geometry.bbox` contains the click — sufficient για Phase 2
   * placement (full hit-test integration lands Phase 2.5).
   */
  const openingTool = useOpeningTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getWallById: (wallId: string): WallEntity | null => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const e = scene.entities.find((x) => x.id === wallId);
      return e && isWallEntity(e) ? (e as WallEntity) : null;
    },
    getWallAtPoint: (point: Readonly<Point2D>): WallEntity | null => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const walls = scene.entities.filter(isWallEntity) as WallEntity[];
      // Bbox containment — adequate for Phase 2 click placement.
      return walls.find((w: WallEntity) => {
        const bb = w.geometry?.bbox;
        if (!bb) return false;
        return point.x >= bb.min.x && point.x <= bb.max.x
            && point.y >= bb.min.y && point.y <= bb.max.y;
      }) ?? null;
    },
    onOpeningCreated: (openingEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      // Update host wall's `hostedOpeningIds` mirror so the wall renderer
      // and BOQ pipeline can find the opening from the host side.
      const nextEntities: Entity[] = scene.entities.map((e) => {
        if (!isWallEntity(e)) return e as Entity;
        if (e.id !== openingEntity.params.wallId) return e as Entity;
        const existing = (e as WallEntity).hostedOpeningIds ?? [];
        if (existing.includes(openingEntity.id)) return e as Entity;
        return { ...(e as WallEntity), hostedOpeningIds: [...existing, openingEntity.id] } as Entity;
      });
      levelManager.setLevelScene(levelId, {
        ...scene,
        entities: [...nextEntities, openingEntity],
      });
      EventBus.emit('drawing:entity-created', { entity: openingEntity, tool: 'opening' });
    },
  });
  const { activate: activateOpening, deactivate: deactivateOpening } = openingTool;
  useEffect(() => {
    if (activeTool === 'opening') {
      activateOpening();
    } else {
      deactivateOpening();
    }
  }, [activeTool, activateOpening, deactivateOpening]);
  // ============================================================================
  // ADR-363 Phase 3 — SLAB TOOL
  // ============================================================================
  /**
   * Slab drawing tool — polygon N-click + Enter (or auto-close near first vertex).
   * State machine in `useSlabTool`. Default kind = 'floor'. Continuous chain.
   * The created `SlabEntity` is appended to the scene AND broadcast via
   * `EventBus` so `useSlabPersistence` can schedule the first Firestore save.
   */
  const slabTool = useSlabTool({
    currentLevelId: levelManager.currentLevelId || '0',
    onSlabCreated: (slabEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      levelManager.setLevelScene(levelId, {
        ...scene,
        entities: [...(scene.entities || []), slabEntity],
      });
      EventBus.emit('drawing:entity-created', { entity: slabEntity, tool: 'slab' });
    },
  });
  const { activate: activateSlab, deactivate: deactivateSlab } = slabTool;
  useEffect(() => {
    if (activeTool === 'slab') {
      activateSlab();
    } else {
      deactivateSlab();
    }
  }, [activeTool, activateSlab, deactivateSlab]);
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
  // ============================================================================
  // AUTO AREA — clear result panel when tool changes away
  // ============================================================================
  useEffect(() => {
    if (activeTool !== 'auto-measure-area') {
      clearAutoAreaState();
      clearAutoAreaPreview();
    }
  }, [activeTool]);
  // ============================================================================
  // RETURN
  // ============================================================================
  return {
    circleTTT,
    linePerpendicular,
    lineParallel,
    angleEntityMeasurement,
    stairTool,
    wallTool,
    openingTool,
    slabTool,
  };
}
export default useSpecialTools;
