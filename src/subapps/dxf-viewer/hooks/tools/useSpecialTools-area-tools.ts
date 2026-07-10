'use client';
/**
 * 🏢 ENTERPRISE: useSpecialToolsAreaTools sub-hook
 *
 * @description Space/area-defining DXF drawing tools, extracted from
 * `useSpecialTools.ts` (SRP / Google file-size standard N.7.1). Groups the
 * footprint-polygon area tools (slab / roof / floor-finish / underfloor-heating),
 * the click-in-region thermal-space tool, and the 2-click space-separator. They
 * all share the same `currentLevelId` + scene-units + scene-entities + auto-close
 * resolvers (hoisted once, ADR-626) + `useToolLifecycle` activation pattern.
 *
 * Pattern: Single Responsibility Principle — Tool Management.
 */
import { useCallback, useEffect } from 'react';
import { useSlabTool, SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useSlabTool';
import { useRoofTool, ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useRoofTool';
import { useFloorFinishTool, FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useFloorFinishTool';
import { useWallCoveringTool } from '../drawing/useWallCoveringTool';
import { isWallEntity, isThermalSpaceEntity, type Entity } from '../../types/entities';
import { appendEntitiesToScene } from '../../bim/scene/append-entity-to-scene';
import { useMepUnderfloorTool, MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useMepUnderfloorTool';
import { useThermalSpaceTool } from '../drawing/useThermalSpaceTool';
import { useSpaceSeparatorTool } from '../drawing/useSpaceSeparatorTool';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { appendEntityToScene } from '../../bim/scene/append-entity-to-scene';
import type { LevelsHookReturn } from '../../systems/levels';

/** Props for the area/space tools sub-hook. */
export interface AreaToolsProps {
  /** Current active tool. */
  activeTool: string;
  /** Level manager for scene access. */
  levelManager: LevelsHookReturn;
}

/** Return type of the area/space tools sub-hook. */
export interface AreaToolsReturn {
  slabTool: ReturnType<typeof useSlabTool>;
  roofTool: ReturnType<typeof useRoofTool>; // ADR-417
  floorFinishTool: ReturnType<typeof useFloorFinishTool>; // ADR-419
  wallCoveringTool: ReturnType<typeof useWallCoveringTool>; // ADR-511
  mepUnderfloorTool: ReturnType<typeof useMepUnderfloorTool>; // ADR-408 Εύρος Β #3
  thermalSpaceTool: ReturnType<typeof useThermalSpaceTool>; // ADR-422
  spaceSeparatorTool: ReturnType<typeof useSpaceSeparatorTool>; // ADR-437
}

/**
 * 🏢 ENTERPRISE: Space/area-defining drawing tools hook.
 */
export function useSpecialToolsAreaTools(props: AreaToolsProps): AreaToolsReturn {
  const { activeTool, levelManager } = props;
  const currentLevelId = levelManager.currentLevelId || '0';

  // ── Shared scene resolvers (hoisted once — ADR-626; all area tools read the
  //    same level scene for units / face-snap targets / auto-close tolerance). ──
  const getSceneUnits = useCallback((): SceneUnits => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return 'mm';
    return resolveSceneUnits(levelManager.getLevelScene(levelId));
  }, [levelManager]);

  // ADR-514 Φ6 — live scene entities για τον face-snap κορυφών (flush σε παρειά μέλους).
  const getSceneEntities = useCallback((): readonly Entity[] => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return [];
    return levelManager.getLevelScene(levelId)?.entities ?? [];
  }, [levelManager]);

  // Auto-close tolerance resolver (world units) parameterised by the tool's mm default.
  const makeAutoCloseTolerance = useCallback(
    (defaultMm: number) => (): number => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      const units = scene ? resolveSceneUnits(scene) : 'mm';
      return defaultMm * mmToSceneUnits(units);
    },
    [levelManager],
  );

  // ADR-363 Phase 3 — SLAB TOOL: polygon N-click + Enter (or auto-close near first
  // vertex). Default kind = 'floor'. Continuous chain. The created `SlabEntity` is
  // appended + broadcast so `useSlabPersistence` schedules the first Firestore save.
  const slabTool = useSlabTool({
    currentLevelId,
    getAutoCloseTolerance: makeAutoCloseTolerance(SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT),
    getSceneUnits,
    getSceneEntities,
    onSlabCreated: (slabEntity) => appendEntityToScene(levelManager, slabEntity, 'slab'),
  });
  useToolLifecycle(activeTool === 'slab', slabTool.activate, slabTool.deactivate);

  // ADR-417 — ROOF TOOL: footprint polygon N-click + Enter (mirror slab). The
  // created `RoofEntity` is appended + broadcast so `RoofPersistenceHost` saves it.
  const roofTool = useRoofTool({
    currentLevelId,
    getAutoCloseTolerance: makeAutoCloseTolerance(ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT),
    getSceneUnits,
    getSceneEntities,
    onRoofCreated: (roofEntity) => appendEntityToScene(levelManager, roofEntity, 'roof'),
  });
  useToolLifecycle(activeTool === 'roof', roofTool.activate, roofTool.deactivate);

  // ADR-419 — FLOOR-FINISH TOOL: footprint polygon N-click + Enter (mirror roof). The
  // created `FloorFinishEntity` is appended + broadcast so `FloorFinishPersistenceHost` saves it.
  const floorFinishTool = useFloorFinishTool({
    currentLevelId,
    getAutoCloseTolerance: makeAutoCloseTolerance(FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT),
    getSceneUnits,
    getSceneEntities,
    onFloorFinishCreated: (entity) => appendEntityToScene(levelManager, entity, 'floor-finish'),
  });
  useToolLifecycle(activeTool === 'floor-finish', floorFinishTool.activate, floorFinishTool.deactivate);

  // ADR-511 — WALL-COVERING TOOL: pick τοίχου+παρειάς → 2-click span (φινίρισμα ανά δωμάτιο/παρειά).
  // Ο host τοίχος αντλείται live από τη σκηνή (walls only). Continuous chain. Το created
  // `WallCoveringEntity` γίνεται append + broadcast ώστε ο `WallCoveringPersistenceHost` να σώσει.
  const wallCoveringTool = useWallCoveringTool({
    currentLevelId,
    // WallEntity ικανοποιεί δομικά το WallCoveringHost (id + geometry + params.thickness).
    getWalls: () => getSceneEntities().filter(isWallEntity),
    // ThermalSpaceEntity (IfcSpace) — τα δωμάτια που ορίζουν το room-fill extent.
    getSpaces: () => getSceneEntities().filter(isThermalSpaceEntity),
    getSceneUnits,
    onWallCoveringCreated: (entity) => appendEntityToScene(levelManager, entity, 'wall-covering'),
    // Slice C — room-fill: όλα τα regions σε ΕΝΑ undo (CompoundCommand).
    onRoomFillCreated: (entities) => appendEntitiesToScene(levelManager, entities, 'wall-covering', 'Room-fill wall covering'),
  });
  const isWallCoveringActive = activeTool === 'wall-covering' || activeTool === 'wall-covering-room';
  useToolLifecycle(isWallCoveringActive, wallCoveringTool.activate, wallCoveringTool.deactivate);
  // Slice C — το active tool id οδηγεί το mode (mirror column freehand/perimeter).
  useEffect(() => {
    if (activeTool === 'wall-covering') wallCoveringTool.setMode('manual');
    else if (activeTool === 'wall-covering-room') wallCoveringTool.setMode('room-fill');
  }, [activeTool, wallCoveringTool]);

  // ADR-408 Εύρος Β #3 — UNDERFLOOR HEATING TOOL: heating-area polygon N-click + Enter
  // (mirror floor-finish). The created `MepUnderfloorEntity` is appended + broadcast so
  // `MepUnderfloorPersistenceHost` saves it.
  const mepUnderfloorTool = useMepUnderfloorTool({
    currentLevelId,
    getAutoCloseTolerance: makeAutoCloseTolerance(MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT),
    getSceneUnits,
    getSceneEntities,
    onMepUnderfloorCreated: (entity) => appendEntityToScene(levelManager, entity, 'mep-underfloor'),
  });
  useToolLifecycle(activeTool === 'mep-underfloor', mepUnderfloorTool.activate, mepUnderfloorTool.deactivate);

  // ADR-422 — THERMAL-SPACE TOOL: Revit «Place Space» click-in-region (single click
  // inside a room → footprint auto-derived from the enclosing wall loop). The created
  // `ThermalSpaceEntity` is appended + broadcast so `ThermalSpacePersistenceHost` saves it.
  const thermalSpaceTool = useThermalSpaceTool({
    currentLevelId,
    getSceneEntities,
    getSceneUnits,
    onThermalSpaceCreated: (entity) => appendEntityToScene(levelManager, entity, 'thermal-space'),
  });
  useToolLifecycle(activeTool === 'thermal-space', thermalSpaceTool.activate, thermalSpaceTool.deactivate);

  // ADR-437 — SPACE SEPARATOR TOOL (2-click line; participates in region detection).
  const spaceSeparatorTool = useSpaceSeparatorTool({
    currentLevelId,
    getSceneUnits,
    onSpaceSeparatorCreated: (entity) => appendEntityToScene(levelManager, entity, 'space-separator'),
  });
  useToolLifecycle(activeTool === 'space-separator', spaceSeparatorTool.activate, spaceSeparatorTool.deactivate);

  return {
    slabTool,
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
  };
}
