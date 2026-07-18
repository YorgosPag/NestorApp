/**
 * @module useGuideWorkflowComputed
 * @enterprise ADR-189 — Computed values: highlight detection + ghost previews
 *
 * Extracted from useGuideToolWorkflows.ts (SRP: derived/computed only).
 */
import { useMemo } from 'react';
import { pointToSegmentDistance, GUIDE_HIT_TOLERANCE_PX } from '../../systems/guides/guide-types';
import type { Guide, Point2D } from '../../systems/guides/guide-types';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
// ADR-189 §3.13 — WYSIWYG φάντασμα: όσο πληκτρολογείται απόσταση, το φάντασμα
// κουμπώνει σε αυτήν αντί να ακολουθεί τον κέρσορα.
import { useCanvasNumericPendingDistance, useCanvasNumericAnchor } from '../../systems/canvas-numeric-input/CanvasNumericInputStore';
import { resolveParallelGhostOffset, resolveParallelGhostDiagonal } from '../../systems/guides/guide-parallel-ghost';
import { resolveParallelCursor, readParallelCursorToggles } from '../../systems/guides/guide-parallel-cursor';

/**
 * Ο κέρσορας που «βλέπει» το φάντασμα-οδηγός — ΜΕΤΑ ΟΡΘΟ και ΒΗΜΑ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το φάντασμα είναι ο ΠΕΜΠΤΟΣ αναγνώστης του ίδιου κέρσορα (μαζί με τη
 * διακεκομμένη, το λευκό HUD, το Enter και το κλικ). Όσο έπαιρνε τον ΩΜΟ κέρσορα, με F9
 * ενεργό ζωγραφιζόταν στο 23 ενώ ο οδηγός έπεφτε στο 20 — δύο στοιχεία της ΙΔΙΑΣ οθόνης
 * σε διαφορετική θέση. Περνώντας το περιορισμένο σημείο, διορθώνεται ΚΑΙ η πλευρά:
 * το `guide-parallel-ghost` καλεί εσωτερικά `resolveParallelSide(cursor)`, οπότε παίρνει
 * πλέον το ίδιο πρόσημο με το commit (το βήμα ΜΠΟΡΕΙ να γυρίσει πλευρά — βλ. slice A test).
 */
function constrainParallelCursor(refGuide: Guide, anchor: Point2D | null, cursor: Point2D): Point2D {
  if (!anchor) return cursor;
  return resolveParallelCursor(refGuide, anchor, cursor, readParallelCursorToggles()).point;
}
import type { ToolType } from '../../ui/toolbar/types';
import type { UseGuideStateReturn } from '../state/useGuideState';
import type { UseConstructionPointStateReturn } from '../state/useConstructionPointState';
import type { GuideWorkflowState } from './guide-workflow-types';

interface UseGuideWorkflowComputedParams {
  activeTool: ToolType | string;
  guideState: UseGuideStateReturn;
  cpState: UseConstructionPointStateReturn;
  transform: { scale: number; offsetX: number; offsetY: number };
  state: GuideWorkflowState;
}

/**
 * 🚀 PERF (2026-05-09): mouseWorld now read via `useCursorWorldPosition()`
 * (useSyncExternalStore on ImmediatePositionStore). The hook MUST be invoked
 * in a leaf component (CanvasLayerStack) so that mousemove-triggered
 * re-renders stay scoped to the canvas tree, not CanvasSection.
 */
export function useGuideWorkflowComputed(params: UseGuideWorkflowComputedParams) {
  const { activeTool, guideState, cpState, transform, state } = params;
  const mouseWorld = useCursorWorldPosition();
  // Low-frequency: αλλάζει ΜΟΝΟ σε πάτημα πλήκτρου, όχι στα 60fps του κέρσορα.
  const typedDistance = useCanvasNumericPendingDistance();
  // Low-frequency: παγώνει 1× στο κλικ επιλογής αναφοράς (ADR-189 §3.13).
  const parallelAnchor = useCanvasNumericAnchor();

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
      const hitToleranceWorld = GUIDE_HIT_TOLERANCE_PX / transform.scale;
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
        const cursor = constrainParallelCursor(refGuide, parallelAnchor, mouseWorld);
        return { axis: refGuide.axis, offset: resolveParallelGhostOffset(refGuide, cursor, typedDistance) };
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
  }, [activeTool, mouseWorld, typedDistance, parallelAnchor, state.parallelRefGuideId, state.perpRefGuideId, guideState.guides]);

  const ghostDiagonalGuide = useMemo(() => {
    if (!mouseWorld) return null;

    if (activeTool === 'guide-parallel' && state.parallelRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === state.parallelRefGuideId);
      if (refGuide) {
        const cursor = constrainParallelCursor(refGuide, parallelAnchor, mouseWorld);
        const diagonal = resolveParallelGhostDiagonal(refGuide, cursor, typedDistance);
        if (diagonal) return diagonal;
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
  }, [activeTool, mouseWorld, typedDistance, parallelAnchor, state.diagonalStep, state.diagonalStartPoint, state.diagonalDirectionPoint, state.parallelRefGuideId, guideState.guides]);

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
