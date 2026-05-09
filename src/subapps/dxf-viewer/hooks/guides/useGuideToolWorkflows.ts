/**
 * useGuideToolWorkflows — ADR-189 Guide Tool State & Workflows
 *
 * Orchestrator hook that composes:
 * - useGuideWorkflowState (multi-step state, reset effects, tool hints)
 * - useGuideWorkflowHandlers (core workflow handlers)
 * - useGuideEntityHandlers (entity/selection/arc/context/measurement)
 * - useGuideWorkflowComputed (highlights, ghost previews)
 *
 * Split for SRP compliance (Google 500-line limit).
 */
import { useGuideWorkflowState } from './useGuideWorkflowState';
import { useGuideWorkflowHandlers } from './useGuideWorkflowHandlers';
import { useGuideEntityHandlers } from './useGuideEntityHandlers';
import type { GuideToolWorkflowsParams } from './guide-workflow-types';

export type { ArcPickableEntity, LinePickableEntity } from './guide-workflow-types';

/**
 * 🚀 PERF (2026-05-09): mouse-driven computed values (ghost previews,
 * highlight detection) MOVED to `useGuideWorkflowComputed` invoked downstream
 * (CanvasLayerStack), so subscribing to world position re-renders only the
 * leaf canvas tree instead of the full CanvasSection. This hook now exposes
 * `state` directly so the downstream computed hook can read it.
 */
export function useGuideToolWorkflows(params: GuideToolWorkflowsParams) {
  const {
    activeTool, guideState, cpState, showPromptDialog, t,
    notifyWarning, notifySuccess,
    universalSelection, currentScene, eventBus,
  } = params;

  // 1. State management (multi-step tool state + reset effects + tool hint sync)
  const state = useGuideWorkflowState({ activeTool, guideState, eventBus });

  // 2. Core workflow handlers (parallel, rotate, equalize, diagonal, etc.)
  const coreHandlers = useGuideWorkflowHandlers({
    guideState, cpState, showPromptDialog, t, notifyWarning, state,
  });

  // 3. Entity/selection/arc/context/measurement handlers
  const entityHandlers = useGuideEntityHandlers({
    activeTool, guideState, cpState, showPromptDialog, t,
    notifyWarning, notifySuccess, universalSelection, currentScene, state,
  });

  return {
    // Full workflow state — passed to `useGuideWorkflowComputed` downstream
    state,

    // Multi-step tool state (needed by useCanvasClickHandler)
    parallelRefGuideId: state.parallelRefGuideId,
    perpRefGuideId: state.perpRefGuideId,
    diagonalStep: state.diagonalStep,
    diagonalStartPoint: state.diagonalStartPoint,
    diagonalDirectionPoint: state.diagonalDirectionPoint,
    segmentsStep: state.segmentsStep,
    segmentsStartPoint: state.segmentsStartPoint,
    distanceStep: state.distanceStep,
    distanceStartPoint: state.distanceStartPoint,
    rotateRefGuideId: state.rotateRefGuideId,
    rotateGroupSelectedIds: state.rotateGroupSelectedIds,
    equalizeSelectedIds: state.equalizeSelectedIds,
    arcLineStep: state.arcLineStep,
    circleIntersectStep: state.circleIntersectStep,
    selectedGuideIds: state.selectedGuideIds,
    setSelectedGuideIds: state.setSelectedGuideIds,
    panelHighlightPointId: state.panelHighlightPointId,

    // All handlers
    ...coreHandlers,
    ...entityHandlers,
  } as const;
}
