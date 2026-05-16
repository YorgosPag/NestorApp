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
import { useCircleTTT } from '../drawing/useCircleTTT';
import { clearAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { clearAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { useLinePerpendicular } from '../drawing/useLinePerpendicular';
import { useLineParallel } from '../drawing/useLineParallel';
import { useStairTool } from '../drawing/useStairTool';
import { detectSceneUnits } from '../drawing/stair-completion';
import { useAngleEntityMeasurement, type AngleEntityVariant } from './useAngleEntityMeasurement';
import type { AngleMeasurementEntity } from '../../types/entities';
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
    // Uses heuristic `detectSceneUnits(bounds)` because `dxf-scene-builder`
    // hardcodes `scene.units = 'mm'` even for meter-based DXF files
    // (carryover: fix the builder to propagate `$INSUNITS`).
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      const scene = levelManager.getLevelScene(levelId);
      if (!scene?.bounds) return 'mm';
      return detectSceneUnits(scene.bounds);
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
  };
}

export default useSpecialTools;
