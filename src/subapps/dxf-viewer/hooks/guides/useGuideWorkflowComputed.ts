/**
 * @module useGuideWorkflowComputed
 * @enterprise ADR-189 — Computed values: highlight detection + ghost previews
 *
 * Extracted from useGuideToolWorkflows.ts (SRP: derived/computed only).
 */
import { useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import type { ToolType } from '../../ui/toolbar/types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { UseConstructionPointStateReturn } from '../state/useConstructionPointState';
import type { GuideWorkflowState } from './guide-workflow-types';

interface UseGuideWorkflowComputedParams {
  activeTool: ToolType | string;
  guideState: UseGuideStateReturn;
  cpState: UseConstructionPointStateReturn;
  transform: { scale: number; offsetX: number; offsetY: number };
  mouseWorld: Point2D | null;
  state: GuideWorkflowState;
}

export function useGuideWorkflowComputed(params: UseGuideWorkflowComputedParams) {
  const { activeTool, guideState, cpState, transform, mouseWorld, state } = params;

  // ─── Highlight computation ───
  const highlightedGuideId = useMemo<string | null>(() => {
    if (!mouseWorld || !guideState.guides.length) return null;

    const needsToolHighlight =
      activeTool === 'guide-delete' ||
      (activeTool === 'guide-perpendicular' && !state.perpRefGuideId) ||
      activeTool === 'guide-move' ||
      (activeTool === 'guide-parallel' && !state.parallelRefGuideId) ||
      (activeTool === 'guide-rotate' && !state.rotateRefGuideId) ||
      activeTool === 'guide-rotate-group' ||
      activeTool === 'guide-equalize' ||
      activeTool === 'guide-mirror';

    if (needsToolHighlight) {
      const hitToleranceWorld = 30 / transform.scale;
      let nearestId: string | null = null;
      let nearestDist = hitToleranceWorld;
      for (const guide of guideState.guides) {
        if (!guide.visible) continue;
        let dist: number;
        if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          dist = pointToSegmentDistance(mouseWorld, guide.startPoint, guide.endPoint);
        } else {
          dist = guide.axis === 'X'
            ? Math.abs(mouseWorld.x - guide.offset)
            : Math.abs(mouseWorld.y - guide.offset);
        }
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = guide.id;
        }
      }
      return nearestId;
    }

    if (state.parallelRefGuideId) return state.parallelRefGuideId;
    if (state.perpRefGuideId) return state.perpRefGuideId;
    if (state.rotateRefGuideId) return state.rotateRefGuideId;

    const snap = getImmediateSnap();
    if (snap?.found && snap.mode === 'guide' && snap.entityId) {
      return snap.entityId;
    }

    return null;
  }, [mouseWorld, guideState.guides, activeTool, state.parallelRefGuideId, state.perpRefGuideId, state.rotateRefGuideId, transform.scale]);

  const effectiveHighlightedGuideId = highlightedGuideId ?? state.panelHighlightGuideId;

  const highlightedPointId = useMemo<string | null>(() => {
    if (!mouseWorld || activeTool !== 'guide-delete-point') return null;
    const hitToleranceWorld = 30 / transform.scale;
    const nearest = cpState.findNearest(mouseWorld, hitToleranceWorld);
    return nearest?.id ?? null;
  }, [mouseWorld, activeTool, cpState, transform.scale]);

  // ─── Ghost previews ───
  const ghostGuide = useMemo(() => {
    if (!mouseWorld) return null;
    if (activeTool === 'guide-x') return { axis: 'X' as const, offset: mouseWorld.x };
    if (activeTool === 'guide-z') return { axis: 'Y' as const, offset: mouseWorld.y };
    if (activeTool === 'guide-parallel' && state.parallelRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === state.parallelRefGuideId);
      if (refGuide && refGuide.axis !== 'XZ') {
        return { axis: refGuide.axis, offset: refGuide.axis === 'X' ? mouseWorld.x : mouseWorld.y };
      }
    }
    if (activeTool === 'guide-perpendicular' && state.perpRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === state.perpRefGuideId);
      if (refGuide && refGuide.axis !== 'XZ') {
        const perpAxis = refGuide.axis === 'X' ? 'Y' as const : 'X' as const;
        return { axis: perpAxis, offset: perpAxis === 'X' ? mouseWorld.x : mouseWorld.y };
      }
    }
    return null;
  }, [activeTool, mouseWorld, state.parallelRefGuideId, state.perpRefGuideId, guideState.guides]);

  const ghostDiagonalGuide = useMemo(() => {
    if (!mouseWorld) return null;

    if (activeTool === 'guide-parallel' && state.parallelRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === state.parallelRefGuideId);
      if (refGuide?.axis === 'XZ' && refGuide.startPoint && refGuide.endPoint) {
        const dx = refGuide.endPoint.x - refGuide.startPoint.x;
        const dy = refGuide.endPoint.y - refGuide.startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const nx = -dy / len;
          const ny = dx / len;
          const perpDist = (mouseWorld.x - refGuide.startPoint.x) * nx + (mouseWorld.y - refGuide.startPoint.y) * ny;
          return {
            start: { x: refGuide.startPoint.x + nx * perpDist, y: refGuide.startPoint.y + ny * perpDist },
            end: { x: refGuide.endPoint.x + nx * perpDist, y: refGuide.endPoint.y + ny * perpDist },
          };
        }
      }
    }

    if (activeTool !== 'guide-xz') return null;

    if (state.diagonalStep === 1 && state.diagonalStartPoint) {
      return { start: state.diagonalStartPoint, end: mouseWorld };
    }

    if (state.diagonalStep === 2 && state.diagonalStartPoint && state.diagonalDirectionPoint) {
      const dx = state.diagonalDirectionPoint.x - state.diagonalStartPoint.x;
      const dy = state.diagonalDirectionPoint.y - state.diagonalStartPoint.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return null;
      const tParam = ((mouseWorld.x - state.diagonalStartPoint.x) * dx + (mouseWorld.y - state.diagonalStartPoint.y) * dy) / lenSq;
      return {
        start: state.diagonalStartPoint,
        end: { x: state.diagonalStartPoint.x + tParam * dx, y: state.diagonalStartPoint.y + tParam * dy },
      };
    }

    return null;
  }, [activeTool, mouseWorld, state.diagonalStep, state.diagonalStartPoint, state.diagonalDirectionPoint, state.parallelRefGuideId, guideState.guides]);

  const ghostSegmentLine = useMemo(() => {
    if (!mouseWorld) return null;
    if (activeTool === 'guide-segments' && state.segmentsStep === 1 && state.segmentsStartPoint) {
      return { start: state.segmentsStartPoint, end: mouseWorld };
    }
    if (activeTool === 'guide-distance' && state.distanceStep === 1 && state.distanceStartPoint) {
      return { start: state.distanceStartPoint, end: mouseWorld };
    }
    return null;
  }, [activeTool, mouseWorld, state.segmentsStep, state.segmentsStartPoint, state.distanceStep, state.distanceStartPoint]);

  return {
    effectiveHighlightedGuideId,
    highlightedPointId,
    panelHighlightPointId: state.panelHighlightPointId,
    ghostGuide,
    ghostDiagonalGuide,
    ghostSegmentLine,
  } as const;
}
