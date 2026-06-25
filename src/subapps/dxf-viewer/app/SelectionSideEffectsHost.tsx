'use client';

/**
 * SelectionSideEffectsHost — ADR-532 Stage B5 leaf host (renders null).
 *
 * Owns the two SELECTION-DRIVEN effects that used to live in
 * `useDxfViewerEffects` (and therefore re-ran the whole `DxfViewerContent`
 * orchestrator on every click). Per the ADR-040 dual-access invariant, only a
 * leaf may subscribe to the selection set: this host subscribes via
 * `useSelectedEntityIds()` + `usePrimarySelectedId()` so a selection change
 * re-renders THIS null component instead of the orchestrator subtree.
 *
 *  1. Auto-expand the levels panel for the current selection (≤50 entities).
 *  2. Auto-activate the layering tool when an overlay/region becomes primary.
 *
 * Related files:
 * - DxfViewerContent.tsx (renders this host)
 * - useDxfViewerEffects.ts (the non-selection effects stay there)
 */

import React from 'react';
import { useSelectedEntityIds, usePrimarySelectedId, SelectedEntitiesStore } from '../systems/selection';
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';

export interface SelectionSideEffectsHostProps {
  readonly floatingRef: React.RefObject<FloatingPanelHandle | null>;
  readonly currentScene: SceneModel | null;
  readonly activeTool: ToolType;
  readonly handleToolChange: (tool: ToolType) => void;
}

/**
 * Null-rendering leaf that runs the selection-driven effects off its own
 * store subscription (ADR-532 Stage B5). Memoized so non-selection prop
 * churn from the parent doesn't re-run the effects needlessly.
 */
export const SelectionSideEffectsHost = React.memo<SelectionSideEffectsHostProps>(({
  floatingRef,
  currentScene,
  activeTool,
  handleToolChange,
}) => {
  const selectedEntityIds = useSelectedEntityIds();
  const primarySelectedId = usePrimarySelectedId();
  const prevPrimarySelectedIdRef = React.useRef<string | null>(null);

  // Auto-expand selection in levels panel when selection changes.
  // Skip for large selections (Ctrl+A) — expanding 3000+ nodes causes 0 FPS.
  React.useEffect(() => {
    if (!selectedEntityIds?.length) return;
    if (selectedEntityIds.length > 50) return;
    floatingRef.current?.expandForSelection(selectedEntityIds, currentScene);
  }, [selectedEntityIds, currentScene, floatingRef]);

  // 🔺 AUTO-ACTIVATE LAYERING TOOL when an overlay/region becomes primary.
  React.useEffect(() => {
    const isNewSelection = primarySelectedId !== null && primarySelectedId !== prevPrimarySelectedIdRef.current;
    prevPrimarySelectedIdRef.current = primarySelectedId;

    if (isNewSelection && activeTool !== 'layering') {
      const primaryEntry = SelectedEntitiesStore.getMap().get(primarySelectedId!);
      const isOverlaySelection = primaryEntry?.type === 'overlay' || primaryEntry?.type === 'region';
      if (isOverlaySelection) {
        handleToolChange('layering');
      }
    }
  }, [primarySelectedId, activeTool, handleToolChange]);

  return null;
});

SelectionSideEffectsHost.displayName = 'SelectionSideEffectsHost';
