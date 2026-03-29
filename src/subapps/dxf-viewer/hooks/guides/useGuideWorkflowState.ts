/**
 * @module useGuideWorkflowState
 * @enterprise ADR-189 — Multi-step tool state, reset effects, tool hint sync
 *
 * Extracted from useGuideToolWorkflows.ts (SRP: state management only).
 */
import { useState, useEffect } from 'react';
import { EventBus } from '../../systems/events';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { ToolType } from '../../ui/toolbar/types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { GuideWorkflowState, ArcPickableEntity, LinePickableEntity } from './guide-workflow-types';

interface UseGuideWorkflowStateParams {
  activeTool: ToolType | string;
  guideState: UseGuideStateReturn;
  eventBus: ReturnType<typeof import('../../systems/events').useEventBus>;
}

export function useGuideWorkflowState({
  activeTool,
  guideState,
  eventBus,
}: UseGuideWorkflowStateParams): GuideWorkflowState {
  // ─── Multi-step tool state ───
  const [parallelRefGuideId, setParallelRefGuideId] = useState<string | null>(null);
  const [diagonalStep, setDiagonalStep] = useState<0 | 1 | 2>(0);
  const [diagonalStartPoint, setDiagonalStartPoint] = useState<Point2D | null>(null);
  const [diagonalDirectionPoint, setDiagonalDirectionPoint] = useState<Point2D | null>(null);
  const [rotateRefGuideId, setRotateRefGuideId] = useState<string | null>(null);
  const [rotateGroupSelectedIds, setRotateGroupSelectedIds] = useState<Set<string>>(new Set());
  const [equalizeSelectedIds, setEqualizeSelectedIds] = useState<Set<string>>(new Set());
  const [perpRefGuideId, setPerpRefGuideId] = useState<string | null>(null);
  const [segmentsStep, setSegmentsStep] = useState<0 | 1>(0);
  const [segmentsStartPoint, setSegmentsStartPoint] = useState<Point2D | null>(null);
  const [distanceStep, setDistanceStep] = useState<0 | 1>(0);
  const [distanceStartPoint, setDistanceStartPoint] = useState<Point2D | null>(null);
  const [arcLineStep, setArcLineStep] = useState<0 | 1>(0);
  const [arcLineLine, setArcLineLine] = useState<LinePickableEntity | null>(null);
  const [circleIntersectStep, setCircleIntersectStep] = useState<0 | 1>(0);
  const [circleIntersectFirst, setCircleIntersectFirst] = useState<ArcPickableEntity | null>(null);
  const [selectedGuideIds, setSelectedGuideIds] = useState<ReadonlySet<string>>(new Set());

  // ─── Tool reset effects ───
  useEffect(() => {
    if (activeTool !== 'guide-parallel') setParallelRefGuideId(null);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-rotate') setRotateRefGuideId(null);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-rotate-group') setRotateGroupSelectedIds(new Set());
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-equalize') setEqualizeSelectedIds(new Set());
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-xz') {
      setDiagonalStep(0);
      setDiagonalStartPoint(null);
      setDiagonalDirectionPoint(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-perpendicular') setPerpRefGuideId(null);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-segments') {
      setSegmentsStep(0);
      setSegmentsStartPoint(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-distance') {
      setDistanceStep(0);
      setDistanceStartPoint(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-arc-line-intersect') {
      setArcLineStep(0);
      setArcLineLine(null);
    }
    if (activeTool !== 'guide-circle-intersect') {
      setCircleIntersectStep(0);
      setCircleIntersectFirst(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-select' && activeTool !== 'guide-copy-pattern') {
      setSelectedGuideIds(new Set());
    }
  }, [activeTool]);

  // ─── Tool hint sync ───
  useEffect(() => {
    if (activeTool === 'guide-perpendicular') {
      toolHintOverrideStore.setStepOverride(perpRefGuideId ? 1 : 0);
    } else if (activeTool === 'guide-xz') {
      toolHintOverrideStore.setStepOverride(diagonalStep);
    } else if (activeTool === 'guide-parallel') {
      toolHintOverrideStore.setStepOverride(parallelRefGuideId ? 1 : 0);
    } else if (activeTool === 'guide-segments') {
      toolHintOverrideStore.setStepOverride(segmentsStep);
    } else if (activeTool === 'guide-distance') {
      toolHintOverrideStore.setStepOverride(distanceStep);
    } else if (activeTool === 'guide-arc-line-intersect') {
      toolHintOverrideStore.setStepOverride(arcLineStep);
    } else if (activeTool === 'guide-circle-intersect') {
      toolHintOverrideStore.setStepOverride(circleIntersectStep);
    } else if (activeTool === 'guide-rotate') {
      toolHintOverrideStore.setStepOverride(rotateRefGuideId ? 1 : 0);
    } else if (activeTool === 'guide-rotate-group') {
      toolHintOverrideStore.setStepOverride(rotateGroupSelectedIds.size > 0 ? 1 : 0);
    } else if (activeTool === 'guide-equalize') {
      toolHintOverrideStore.setStepOverride(equalizeSelectedIds.size >= 3 ? 1 : 0);
    } else {
      toolHintOverrideStore.setStepOverride(null);
    }
  }, [activeTool, perpRefGuideId, diagonalStep, parallelRefGuideId, segmentsStep, distanceStep, arcLineStep, circleIntersectStep, rotateRefGuideId, rotateGroupSelectedIds, equalizeSelectedIds]);

  // ─── Panel highlight (event bus) ───
  const [panelHighlightGuideId, setPanelHighlightGuideId] = useState<string | null>(null);
  const [panelHighlightPointId, setPanelHighlightPointId] = useState<string | null>(null);

  useEffect(() => {
    return eventBus.on('grid:guide-panel-highlight', ({ guideId }) => {
      setPanelHighlightGuideId(guideId ?? null);
    });
  }, [eventBus]);

  useEffect(() => {
    return eventBus.on('grid:point-panel-highlight', ({ pointId }) => {
      setPanelHighlightPointId(pointId ?? null);
    });
  }, [eventBus]);

  // B35: Auto-remove temporary guides on drawing complete
  useEffect(() => {
    return EventBus.on('drawing:complete', () => {
      const removed = guideState.getStore().removeTemporaryGuides();
      if (removed.length > 0) {
        EventBus.emit('grid:temporary-guides-removed', { count: removed.length });
      }
    });
  }, [guideState]);

  return {
    parallelRefGuideId, setParallelRefGuideId,
    diagonalStep, setDiagonalStep,
    diagonalStartPoint, setDiagonalStartPoint,
    diagonalDirectionPoint, setDiagonalDirectionPoint,
    rotateRefGuideId, setRotateRefGuideId,
    rotateGroupSelectedIds, setRotateGroupSelectedIds,
    equalizeSelectedIds, setEqualizeSelectedIds,
    perpRefGuideId, setPerpRefGuideId,
    segmentsStep, setSegmentsStep,
    segmentsStartPoint, setSegmentsStartPoint,
    distanceStep, setDistanceStep,
    distanceStartPoint, setDistanceStartPoint,
    arcLineStep, setArcLineStep,
    arcLineLine, setArcLineLine,
    circleIntersectStep, setCircleIntersectStep,
    circleIntersectFirst, setCircleIntersectFirst,
    selectedGuideIds, setSelectedGuideIds,
    panelHighlightGuideId,
    panelHighlightPointId,
  };
}

// Private — Point2D re-import for useState generics
type Point2D = import('../../rendering/types/Types').Point2D;
