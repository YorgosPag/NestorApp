/**
 * ADR-363 — Wall preview-store sync hook (extracted from `useWallTool` for N.7.1 ≤500 lines).
 *
 * Mirrors `stairPreviewStore` writer pattern: on every wall-tool state transition it pushes the
 * current preview shape (startPoint / curveControl / polyline vertices / overrides) so
 * `useUnifiedDrawing.updatePreview` can read it synchronously without subscribing to wall-tool
 * React state. Also drops preview state on unmount so other tools don't see stale ghosts.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6 Phase 1C
 */

import { useEffect } from 'react';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import type { WallToolState } from './wall-tool-types';

export function useWallPreviewSync(state: WallToolState): void {
  // ── preview store sync (ADR-363 Phase 1C) ────────────────────────────────
  useEffect(() => {
    if (state.phase === 'idle') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1K / «από περίγραμμα» — region & perimeter picks are surfaced
    // via selection highlight (box-select), not a rubber-band ghost. No preview shape.
    if (state.placementMode === 'in-region' || state.placementMode === 'outer-perimeter') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1J — on-entity: surface the picked line as a straight ghost
    // (start→end shifted toward the live cursor, reusing the Phase 1F preview
    // generator). Closed sources have no rubber-band ghost (multi-wall).
    if (state.placementMode === 'on-entity') {
      if (state.phase === 'awaitingSide' && state.pickedSource?.kind === 'line') {
        wallPreviewStore.set({
          startPoint: state.pickedSource.start,
          endPoint: state.pickedSource.end,
          curveControl: null,
          polylineVertices: [],
          overrides: state.overrides,
        });
      } else {
        wallPreviewStore.reset();
      }
      return;
    }
    // ADR-363 Phase 1F — surface endPoint to the preview store only during the
    // straight-kind awaitingAlignment phase. In every other state the straight
    // preview falls back to the legacy "start → cursor" rubber band.
    const endPoint =
      state.kind === 'straight' && state.phase === 'awaitingAlignment' ? state.endPoint : null;
    // ADR-565 — curved (circular-arc) live preview: during `awaitingCurveControl`
    // both endpoints are fixed and the cursor is the on-arc "through" point, so
    // surface the committed 2nd click as `arcEndPoint` and let the preview
    // generator tessellate the arc `start → cursor → end`.
    const arcEndPoint =
      state.kind === 'curved' && state.phase === 'awaitingCurveControl' ? state.endPoint : null;
    wallPreviewStore.set({
      startPoint: state.startPoint,
      endPoint,
      curveControl: null,
      arcEndPoint,
      polylineVertices: state.polylineVertices,
      overrides: state.overrides,
      startAnchored: state.startAnchored,
      startJustification: state.startJustification,
      startFaceAngle: state.startFaceAngle,
      anchoredHostId: state.anchoredHostId,
    });
  }, [state]);

  // Drop preview state on unmount so other tools don't see stale ghosts.
  useEffect(() => {
    return () => {
      wallPreviewStore.reset();
    };
  }, []);
}
