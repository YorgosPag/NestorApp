'use client';

/**
 * ADR-557 — live «Ύψος»/«Πλάτος»/«Περιστροφή» ribbon sync during a TEXT/MTEXT resize
 * or rotate grip drag.
 *
 * Pure DATA-SYNC leaf (NO canvas / NO RAF): while the user drags a text resize
 * handle, this reads the live `dragPreview`, projects the selected scene text to a
 * flat `DxfText`, runs the SAME `applyTextGripDrag` SSoT the ghost preview + commit
 * run (preview ≡ commit — zero re-derived math), maps the resulting patch to the
 * `fontHeight` / `widthFactor` ribbon fields, and pushes them through the store's
 * grip-drag preview channel (`setPreview`) so the contextual «Επεξεργαστής Κειμένου»
 * tab tracks the drag frame-for-frame.
 *
 * SSoT reuse (zero new mechanism):
 *   - Live math    → `applyTextGripDrag` (bim/text/text-grips) — the commit's transform.
 *   - Projection   → `projectSceneTextToDxf` (bim/text/project-scene-text) — same as ghost.
 *   - currentPos   → `anchorPos + delta` (identical to apply-entity-preview.ts).
 *   - Suppression  → `setPreview` raises `isPreviewing`, so `useTextToolbarCommandBridge`
 *                    ignores the write → NO UpdateTextStyleCommand / undo entry per frame.
 *
 * On release `dragPreview` → null the hook reconciles the ribbon to the FINAL committed
 * values via `reconcileTextToolbarFromSelection` (the SAME SSoT the selection-sync effect
 * uses). This covers BOTH paths: on COMMIT the scene now carries the new values, on
 * CANCEL/Esc it carries the reverted originals — either way the ribbon settles on the
 * committed state and never keeps a stale live-preview number (the cancel path is the one
 * `useTextToolbarSelectionSync` can NOT catch, since the scene reference is unchanged).
 *
 * WIDTH edge-case (ADR-557 decision #3): a frame-constrained MTEXT resize changes
 * `patch.width` (NO ribbon field) and leaves `patch.widthFactor` undefined — the hook
 * then live-updates ONLY «Ύψος», never writing a misleading «Πλάτος» that would jump
 * back on commit. TEXT / hugging-MTEXT carry `patch.widthFactor` → «Πλάτος» is 1:1 live.
 *
 * @see rendering/ghost/apply-entity-preview.ts — the sibling ghost path (same projection)
 * @see hooks/dimensions/useDimGripGhostPreview.ts — sibling live-follow (dim value)
 */

import React, { useEffect, useRef } from 'react';
import type { DxfGripDragPreview } from '../grip-computation';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { applyTextGripDrag, type TextGripDragInput } from '../../bim/text/text-grips';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { useTextToolbarStore, type TextStylePreviewPatch } from '../../state/text-toolbar';
import { useUniversalSelection } from '../../systems/selection';
import { reconcileTextToolbarFromSelection } from '../../ui/text-toolbar/hooks/useTextToolbarSelectionSync';
// ADR-557/397 — the entity-agnostic rotate hot-grip context (picked pivot + reference
// anchor), published during a `text-rotation` spin. Reading it here makes the LIVE
// «Περιστροφή» preview byte-identical to `commitTextGripDrag` (preview ≡ commit).
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { gripKindOf } from '../grip-kinds';

export interface UseTextGripRibbonSyncProps {
  /** Live grip-drag snapshot (carries `textGripKind` only when a text grip is dragged). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelSceneReader;
}

export function useTextGripRibbonSync(props: UseTextGripRibbonSyncProps): void {
  const { dragPreview, levelManager } = props;
  // Redundant-write guard: skip `setPreview` when the mapped values are unchanged
  // from the previous frame (avoids re-render churn on axis-locked / sub-pixel moves).
  const lastRef = useRef<{
    height: number | null;
    widthFactor: number | null;
    rotation: number | null;
  } | null>(null);
  // Live pick-set (low-freq) — held in a ref so the drag-end reconcile can settle the
  // ribbon on the committed selection WITHOUT adding `selection` to the effect deps.
  const selection = useUniversalSelection();
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  // True once this drag has pushed at least one live preview value — gates the drag-end
  // reconcile so we only re-populate after a real text-grip preview, not on idle renders.
  const wasPreviewingRef = useRef(false);

  useEffect(() => {
    // ADR-602 Stage 4 — shared reset (was duplicated across the two early-return guards
    // below when hoisting the `textGripKind` read — extracted instead of copy-pasting).
    const resetTextPreview = () => {
      lastRef.current = null;
      if (wasPreviewingRef.current) {
        wasPreviewingRef.current = false;
        const { currentLevelId } = levelManager;
        const scene = currentLevelId ? levelManager.getLevelScene(currentLevelId) ?? null : null;
        reconcileTextToolbarFromSelection(selectionRef.current.getIds(), scene);
      }
    };
    // Only a TEXT/MTEXT resize/move/rotation grip carries `textGripKind`. When the drag
    // ends (or an unrelated grip is dragged) `dragPreview` loses `textGripKind`: if we were
    // previewing, reconcile the ribbon to the FINAL committed values (commit OR cancel/Esc)
    // via the shared SSoT, then reset the guards.
    if (!dragPreview) {
      resetTextPreview();
      return;
    }
    // ADR-602 Stage 4 — hoisted once (read ×3 below: this guard + the `useRotateCtx` check
    // + the `applyTextGripDrag` call).
    const textKind = gripKindOf(dragPreview, 'text');
    if (!textKind) {
      resetTextPreview();
      return;
    }
    const { currentLevelId } = levelManager;
    if (!currentLevelId) return;
    const raw = levelManager.getLevelScene(currentLevelId)?.entities?.find(
      (e) => e.id === dragPreview.entityId,
    );
    if (!raw || (raw.type !== 'text' && raw.type !== 'mtext')) return;

    // Project the RAW scene text → flat `DxfText` via the SAME SSoT the ghost uses.
    const dxfText = projectSceneTextToDxf(raw as unknown as TextSceneShape, dragPreview.entityId);
    const { delta, anchorPos, rotatePivot } = dragPreview;
    // ADR-557/397 — resolve the rotation anchor/pivot EXACTLY like `commitTextGripDrag`:
    // the rotate hot-grip flow publishes {pivot, anchor} in `BimRotateHotGripStore`, so
    // preferring it makes the LIVE «Περιστροφή» byte-identical to the commit. It is set live
    // during the 6-click reference flow; a FREE spin only sets it at commit, so we fall back
    // to the dragPreview anchor/pivot (which the ghost uses) → live ≡ ghost ≡ commit either way.
    const rotateCtx = BimRotateHotGripStore.getSnapshot();
    const useRotateCtx =
      textKind === 'text-rotation' &&
      rotateCtx.pivot !== null &&
      rotateCtx.anchor !== null;
    const anchor = useRotateCtx ? rotateCtx.anchor : anchorPos;
    const pivot = useRotateCtx ? rotateCtx.pivot : rotatePivot;
    // currentPos = anchor + delta — EXACTLY the ghost-preview + commit path.
    const currentPos = anchor ? translatePoint(anchor, delta) : { x: delta.x, y: delta.y };
    const input: TextGripDragInput = {
      entity: dxfText,
      delta,
      currentPos,
      ...(pivot ? { pivot } : {}),
    };
    const patch = applyTextGripDrag(textKind, input);
    // Map ONLY the fields this grip actually changed → «Ύψος» / «Πλάτος» / «Περιστροφή»:
    //   resize corner/edge → height (+ widthFactor for TEXT / hugging MTEXT);
    //   rotate            → rotation;
    //   move-only         → none → nothing to live-update.
    // `widthFactor` is written ONLY when the drag produced one — a frame-constrained MTEXT
    // (`patch.width`, no `widthFactor`) live-updates Ύψος alone (ADR-557 decision #3: no
    // jumpy Πλάτος that would snap back on commit).
    const preview: TextStylePreviewPatch = {};
    if (patch.height != null) preview.fontHeight = patch.height;
    if (patch.widthFactor != null) preview.widthFactor = patch.widthFactor;
    if (patch.rotation != null) preview.rotation = patch.rotation;
    if (preview.fontHeight == null && preview.widthFactor == null && preview.rotation == null) {
      return;
    }

    // Redundant-write guard: skip `setPreview` when every mapped value matches last frame.
    const nextHeight = preview.fontHeight ?? null;
    const nextWidthFactor = preview.widthFactor ?? null;
    const nextRotation = preview.rotation ?? null;
    const prev = lastRef.current;
    if (
      prev &&
      prev.height === nextHeight &&
      prev.widthFactor === nextWidthFactor &&
      prev.rotation === nextRotation
    ) {
      return;
    }
    lastRef.current = { height: nextHeight, widthFactor: nextWidthFactor, rotation: nextRotation };

    // Grip-drag preview channel: raises `isPreviewing` (self-clearing microtask), so the
    // command bridge ignores it → no per-frame command / undo entry.
    useTextToolbarStore.getState().setPreview(preview);
    wasPreviewingRef.current = true;
  }, [dragPreview, levelManager]);
}

/** Zero-JSX mount (ADR-040 micro-leaf) — runs the live text-grip ribbon sync. */
export const TextGripRibbonSyncMount = React.memo(function TextGripRibbonSyncMount(
  props: UseTextGripRibbonSyncProps,
) {
  useTextGripRibbonSync(props);
  return null;
});
