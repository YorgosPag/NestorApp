'use client';
/**
 * 🏢 ENTERPRISE: useSpecialToolsAreaTools sub-hook
 *
 * @description Space/area-defining DXF drawing tools, extracted from
 * `useSpecialTools.ts` (SRP / Google file-size standard N.7.1). Groups the
 * footprint-polygon area tools (slab / roof / floor-finish / underfloor-heating),
 * the click-in-region thermal-space tool, and the 2-click space-separator. They
 * all share the same `currentLevelId` + scene-units resolver + `useToolLifecycle`
 * activation pattern; the active tool id drives activation.
 *
 * Pattern: Single Responsibility Principle — Tool Management.
 */
import { useSlabTool, SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useSlabTool';
import { useRoofTool, ROOF_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useRoofTool';
import { useFloorFinishTool, FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useFloorFinishTool';
import { useMepUnderfloorTool, MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT } from '../drawing/useMepUnderfloorTool';
import { useThermalSpaceTool } from '../drawing/useThermalSpaceTool';
import { useSpaceSeparatorTool } from '../drawing/useSpaceSeparatorTool';
import { useToolLifecycle } from './useToolLifecycle';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';
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
  mepUnderfloorTool: ReturnType<typeof useMepUnderfloorTool>; // ADR-408 Εύρος Β #3
  thermalSpaceTool: ReturnType<typeof useThermalSpaceTool>; // ADR-422
  spaceSeparatorTool: ReturnType<typeof useSpaceSeparatorTool>; // ADR-437
}

/**
 * 🏢 ENTERPRISE: Space/area-defining drawing tools hook.
 */
export function useSpecialToolsAreaTools(props: AreaToolsProps): AreaToolsReturn {
  const { activeTool, levelManager } = props;

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
  // ADR-419 — FLOOR-FINISH TOOL: footprint polygon N-click + Enter (mirror roof). The
  // created `FloorFinishEntity` is appended + broadcast so `FloorFinishPersistenceHost` saves it.
  const floorFinishTool = useFloorFinishTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getAutoCloseTolerance: () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      const units = scene ? resolveSceneUnits(scene) : 'mm';
      return FLOOR_FINISH_AUTO_CLOSE_TOLERANCE_DEFAULT * mmToSceneUnits(units);
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onFloorFinishCreated: (entity) => appendEntityToScene(levelManager, entity, 'floor-finish'),
  });
  useToolLifecycle(activeTool === 'floor-finish', floorFinishTool.activate, floorFinishTool.deactivate);
  // ADR-408 Εύρος Β #3 — UNDERFLOOR HEATING TOOL: heating-area polygon N-click + Enter
  // (mirror floor-finish). The created `MepUnderfloorEntity` is appended + broadcast so
  // `MepUnderfloorPersistenceHost` saves it.
  const mepUnderfloorTool = useMepUnderfloorTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getAutoCloseTolerance: () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      const units = scene ? resolveSceneUnits(scene) : 'mm';
      return MEP_UNDERFLOOR_AUTO_CLOSE_TOLERANCE_DEFAULT * mmToSceneUnits(units);
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onMepUnderfloorCreated: (entity) => appendEntityToScene(levelManager, entity, 'mep-underfloor'),
  });
  useToolLifecycle(activeTool === 'mep-underfloor', mepUnderfloorTool.activate, mepUnderfloorTool.deactivate);
  // ADR-422 — THERMAL-SPACE TOOL: Revit «Place Space» click-in-region (single click
  // inside a room → footprint auto-derived from the enclosing wall loop). The created
  // `ThermalSpaceEntity` is appended + broadcast so `ThermalSpacePersistenceHost` saves it.
  const thermalSpaceTool = useThermalSpaceTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneEntities: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return [];
      return levelManager.getLevelScene(levelId)?.entities ?? [];
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onThermalSpaceCreated: (entity) => appendEntityToScene(levelManager, entity, 'thermal-space'),
  });
  useToolLifecycle(activeTool === 'thermal-space', thermalSpaceTool.activate, thermalSpaceTool.deactivate);
  // ADR-437 — SPACE SEPARATOR TOOL (2-click line; participates in region detection).
  const spaceSeparatorTool = useSpaceSeparatorTool({
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onSpaceSeparatorCreated: (entity) => appendEntityToScene(levelManager, entity, 'space-separator'),
  });
  useToolLifecycle(activeTool === 'space-separator', spaceSeparatorTool.activate, spaceSeparatorTool.deactivate);

  return {
    slabTool,
    roofTool,
    floorFinishTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
  };
}
