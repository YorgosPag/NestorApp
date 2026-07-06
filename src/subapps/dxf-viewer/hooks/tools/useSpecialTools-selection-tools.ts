'use client';
/**
 * 🏢 ENTERPRISE: useSpecialToolsSelectionTools Hook
 *
 * @description Selection-based geometry tools extracted from useSpecialTools
 *   (Google file-size SSoT, N.7.1): CircleTTT, LineParallel and
 *   AngleEntityMeasurement. All follow the same pattern — pick existing
 *   entities, then append the created entity to the active level scene.
 *   NOTE (ADR-060): «Κάθετη γραμμή» έφυγε από εδώ — έγινε hover-driven drawing tool.
 *
 * Pattern: Single Responsibility Principle — selection-tool group.
 * Extracted from: useSpecialTools.ts
 */
import { useEffect } from 'react';
import { useCircleTTT } from '../drawing/useCircleTTT';
import { useLineParallel } from '../drawing/useLineParallel';
import { useAngleEntityMeasurement, type AngleEntityVariant } from './useAngleEntityMeasurement';
import type { AngleMeasurementEntity, AnySceneEntity } from '../../types/scene';
import type { LevelsHookReturn } from '../../systems/levels';

export interface SelectionToolsProps {
  activeTool: string;
  levelManager: LevelsHookReturn;
}

export interface SelectionToolsReturn {
  circleTTT: ReturnType<typeof useCircleTTT>;
  lineParallel: ReturnType<typeof useLineParallel>;
  angleEntityMeasurement: ReturnType<typeof useAngleEntityMeasurement>;
}

const ANGLE_ENTITY_TOOLS: ReadonlySet<string> = new Set([
  'measure-angle-constraint', 'measure-angle-line-arc', 'measure-angle-two-arcs',
]);

/**
 * 🏢 ENTERPRISE: selection-based geometry tools (CircleTTT / LinePerpendicular /
 * LineParallel / AngleEntityMeasurement). Each appends its created entity to the
 * current level scene and auto-activates based on the active tool id.
 */
export function useSpecialToolsSelectionTools(props: SelectionToolsProps): SelectionToolsReturn {
  const { activeTool, levelManager } = props;

  // Shared helper — append a freshly created entity to the active level scene.
  const appendToScene = (entity: AnySceneEntity, tag: string): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;
    levelManager.setLevelScene(levelId, {
      ...scene,
      entities: [...(scene.entities || []), entity],
    });
    console.debug(`🎯 [${tag}] entity added to scene:`, entity.id);
  };

  // CIRCLE TTT TOOL — circle tangent to 3 lines.
  const circleTTT = useCircleTTT({
    currentLevelId: levelManager.currentLevelId || '0',
    onCircleCreated: (circleEntity) => appendToScene(circleEntity, 'CircleTTT'),
  });
  const { activate: activateCircleTTT, deactivate: deactivateCircleTTT } = circleTTT;
  useEffect(() => {
    if (activeTool === 'circle-ttt') activateCircleTTT();
    else deactivateCircleTTT();
  }, [activeTool, activateCircleTTT, deactivateCircleTTT]);

  // ADR-060 — «Κάθετη γραμμή»: πλέον hover-driven drawing tool (unified drawing pipeline),
  // ΟΧΙ selection tool εδώ. Βλ. line-perpendicular-preview-helpers.ts + drawing-handler-utils.ts.

  // LINE PARALLEL TOOL — line parallel to a reference line.
  const lineParallel = useLineParallel({
    currentLevelId: levelManager.currentLevelId || '0',
    onLineCreated: (lineEntity) => appendToScene(lineEntity, 'LineParallel'),
  });
  const { activate: activateLineParallel, deactivate: deactivateLineParallel } = lineParallel;
  useEffect(() => {
    if (activeTool === 'line-parallel') activateLineParallel();
    else deactivateLineParallel();
  }, [activeTool, activateLineParallel, deactivateLineParallel]);

  // ANGLE ENTITY MEASUREMENT TOOL (constraint, line-arc, two-arcs).
  const angleEntityMeasurement = useAngleEntityMeasurement({
    onMeasurementCreated: (measurementEntity: AngleMeasurementEntity) =>
      appendToScene(measurementEntity, 'AngleEntityMeasurement'),
  });
  const { activate: activateAngle, deactivate: deactivateAngle } = angleEntityMeasurement;
  useEffect(() => {
    if (ANGLE_ENTITY_TOOLS.has(activeTool)) activateAngle(activeTool as AngleEntityVariant);
    else deactivateAngle();
  }, [activeTool, activateAngle, deactivateAngle]);

  return { circleTTT, lineParallel, angleEntityMeasurement };
}
