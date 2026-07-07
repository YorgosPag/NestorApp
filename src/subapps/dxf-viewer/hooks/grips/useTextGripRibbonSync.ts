'use client';

/**
 * ADR-557 — live «Ύψος»/«Πλάτος» ribbon sync during a TEXT/MTEXT resize grip drag.
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
import type { useLevels } from '../../systems/levels';
import { applyTextGripDrag, type TextGripDragInput } from '../../bim/text/text-grips';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { useTextToolbarStore, type TextStylePreviewPatch } from '../../state/text-toolbar';
import { useUniversalSelection } from '../../systems/selection';
import { reconcileTextToolbarFromSelection } from '../../ui/text-toolbar/hooks/useTextToolbarSelectionSync';
import { notifyRibbonFieldReaders } from '../../ui/ribbon/context/RibbonFieldStore';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseTextGripRibbonSyncProps {
  /** Live grip-drag snapshot (carries `textGripKind` only when a text grip is dragged). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelManagerLike;
}

export function useTextGripRibbonSync(props: UseTextGripRibbonSyncProps): void {
  const { dragPreview, levelManager } = props;
  // Redundant-write guard: skip `setPreview` when the mapped values are unchanged
  // from the previous frame (avoids re-render churn on axis-locked / sub-pixel moves).
  const lastRef = useRef<{ height: number; widthFactor: number | null } | null>(null);
  // Live pick-set (low-freq) — held in a ref so the drag-end reconcile can settle the
  // ribbon on the committed selection WITHOUT adding `selection` to the effect deps.
  const selection = useUniversalSelection();
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  // True once this drag has pushed at least one live preview value — gates the drag-end
  // reconcile so we only re-populate after a real text-grip preview, not on idle renders.
  const wasPreviewingRef = useRef(false);

  useEffect(() => {
    // Only a TEXT/MTEXT resize/move/rotation grip carries `textGripKind`. When the drag
    // ends (or an unrelated grip is dragged) `dragPreview` loses `textGripKind`: if we were
    // previewing, reconcile the ribbon to the FINAL committed values (commit OR cancel/Esc)
    // via the shared SSoT, then reset the guards.
    if (!dragPreview?.textGripKind) {
      lastRef.current = null;
      if (wasPreviewingRef.current) {
        wasPreviewingRef.current = false;
        const { currentLevelId } = levelManager;
        const scene = currentLevelId ? levelManager.getLevelScene(currentLevelId) ?? null : null;
        reconcileTextToolbarFromSelection(selectionRef.current.getIds(), scene);
        // Pulse the ribbon leaves so the settle to committed values shows immediately
        // (the provider does not subscribe to the store → no auto re-notify).
        notifyRibbonFieldReaders();
      }
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
    // currentPos = anchorPos + delta — EXACTLY the ghost-preview path (apply-entity-preview.ts).
    const currentPos = anchorPos ? translatePoint(anchorPos, delta) : { x: delta.x, y: delta.y };
    const input: TextGripDragInput = {
      entity: dxfText,
      delta,
      currentPos,
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    };
    const patch = applyTextGripDrag(dragPreview.textGripKind, input);
    // Move / rotation-only patches do NOT change Ύψος/Πλάτος → nothing to live-update.
    if (patch.height == null && patch.widthFactor == null) return;

    // Map the patch → ribbon fields. `widthFactor` is written ONLY when the drag actually
    // produced one (TEXT / hugging MTEXT); a frame-constrained MTEXT (`patch.width`, no
    // `widthFactor`) live-updates Ύψος alone (ADR-557 decision #3 — avoids a jumpy Πλάτος).
    const preview: TextStylePreviewPatch = { fontHeight: patch.height ?? dxfText.height };
    if (patch.widthFactor != null) preview.widthFactor = patch.widthFactor;

    const nextHeight = preview.fontHeight ?? dxfText.height;
    const nextWidthFactor = preview.widthFactor ?? null;
    const prev = lastRef.current;
    if (prev && prev.height === nextHeight && prev.widthFactor === nextWidthFactor) return;
    lastRef.current = { height: nextHeight, widthFactor: nextWidthFactor };

    // Grip-drag preview channel: raises `isPreviewing` (self-clearing microtask), so the
    // command bridge ignores it → no per-frame command / undo entry.
    useTextToolbarStore.getState().setPreview(preview);
    // The provider reads the store via a getter (never re-renders on store writes), so the
    // combobox leaves only refresh on a RibbonFieldStore notify. Pulse them now → «Ύψος» /
    // «Πλάτος» track the drag frame-for-frame (signature cache re-renders only the 2 moved).
    notifyRibbonFieldReaders();
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
