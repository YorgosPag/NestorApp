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
 *  3. Auto-switch the left panel to the Properties palette when a BIM/stair
 *     element becomes primary (Revit-grade: Properties pops on selection).
 *  4. Selection→text-toolbar populate bridge (ADR-344 6.E / ADR-532 Stage 5),
 *     relocated here off the orchestrator so its selection reactivity lives in
 *     this leaf instead of re-rendering DxfViewerContent on every click.
 *
 * Related files:
 * - DxfViewerContent.tsx (renders this host)
 * - useDxfViewerEffects.ts (the non-selection effects stay there)
 */

import React from 'react';
import { useSelectedEntityIds, usePrimarySelectedId, SelectedEntitiesStore } from '../systems/selection';
// ADR-532 Stage 5 — selection→text-toolbar populate bridge. Genuinely
// selection-reactive (re-derives toolbar values when the pick-set changes), so
// it must live in a LEAF, not in the `DxfViewerContent` orchestrator (where its
// `useUniversalSelection` subscription was one of the 3 hooks re-rendering the
// whole subtree on every click). This null leaf already subscribes to the
// selection, so the reactivity is correctly contained here.
import { useTextToolbarSelectionSync } from '../ui/text-toolbar/hooks/useTextToolbarSelectionSync';
// ADR-557 — live-preview reactivity leaf: pulses the ribbon field store when the grip-drag
// publisher writes live height/widthFactor/rotation, so the Text-Editor tab tracks the drag.
import { TextToolbarRibbonPreviewSyncMount } from '../ui/ribbon/context/TextToolbarRibbonPreviewSync';
import { isBimEntity, isStairEntity, isHatchEntity, isImageEntity } from '../types/entities';
// ADR-510 Φ2E #4 — selecting a style-editable primitive (line/polyline/…) also pops
// the Properties palette (inline «Τμήματα Μοτίβου»), so the user sees it immediately.
import { isStyleEditablePrimitiveType } from '../types/style-editable-primitives';
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
  // ADR-532 Stage 5 — selection→text-toolbar populate (moved off the orchestrator).
  useTextToolbarSelectionSync();
  const selectedEntityIds = useSelectedEntityIds();
  const primarySelectedId = usePrimarySelectedId();
  const prevPrimarySelectedIdRef = React.useRef<string | null>(null);
  const prevPrimaryForPropsRef = React.useRef<string | null>(null);

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

  // 🪟 AUTO-SWITCH to the Properties palette on a NEW BIM/stair primary selection
  // (ADR-358/363/366 — Revit Properties palette pops on selection). Moved here
  // from FloatingPanelContainer so the container no longer needs `primarySelectedId`
  // as a prop (its memo no longer breaks on every click). Revit-correct: fires
  // ONCE per new primary (prevRef), so the user can freely navigate to another
  // tab afterwards without being bounced back (the old activePanel-dep guard
  // pinned the user on Properties). Plain DXF/layer selections are left alone.
  React.useEffect(() => {
    const isNewPrimary =
      primarySelectedId !== null && primarySelectedId !== prevPrimaryForPropsRef.current;
    prevPrimaryForPropsRef.current = primarySelectedId;
    if (!isNewPrimary || !currentScene) return;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    if (!entity) return;
    // ADR-507 — η γραμμοσκίαση δεν είναι isBimEntity/primitive· ρητό branch ώστε το
    // αριστερό Properties palette να ανοίγει ΚΑΙ σε επιλογή hatch (όπως το ribbon tab).
    // ADR-654 — το ίδιο για entourage image (έπιπλο/άνθρωπος/όχημα/φυτό): non-BIM, ρητό branch.
    if (
      isBimEntity(entity) ||
      isStairEntity(entity) ||
      isHatchEntity(entity) ||
      isImageEntity(entity) ||
      isStyleEditablePrimitiveType(entity.type)
    ) {
      floatingRef.current?.showTab('properties');
    }
  }, [primarySelectedId, currentScene, floatingRef]);

  // ADR-557 — dedicated live-preview leaf (subscribes ONLY to the 3 grip-drag fields);
  // isolates the 60fps re-render to this null child, not this selection host.
  return <TextToolbarRibbonPreviewSyncMount />;
});

SelectionSideEffectsHost.displayName = 'SelectionSideEffectsHost';
