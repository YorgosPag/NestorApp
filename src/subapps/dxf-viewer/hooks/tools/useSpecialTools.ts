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
import { useLinePerpendicular } from '../drawing/useLinePerpendicular';
import { useLineParallel } from '../drawing/useLineParallel';
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
      console.log('🎯 [CircleTTT] Circle added to scene:', circleEntity.id);
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
      console.log('🎯 [LinePerpendicular] Line added to scene:', lineEntity.id);
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
      console.log('🎯 [LineParallel] Line added to scene:', lineEntity.id);
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
  // RETURN
  // ============================================================================

  return {
    circleTTT,
    linePerpendicular,
    lineParallel,
  };
}

export default useSpecialTools;
