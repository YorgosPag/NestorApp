/**
 * ADR-363 Phase 4.5c.1 — Column anchor ghost preview hook (RAF-driven).
 *
 * Mirror του `useRotationPreview` pattern: micro-leaf consumer που subscribes
 * σε `useCursorWorldPosition` και ζωγραφίζει τα 9 anchor ghosts απευθείας
 * στο preview canvas (CSS pixels με DPR transform). Ζωντάνεμα μέσω RAF —
 * δεν προκαλεί React re-renders πάνω από αυτό το leaf.
 *
 * Subscribes εσωτερικά στο cursor world position store για να μην ξαπλώνει
 * mousemove re-renders πάνω στο `CanvasSection` (ADR-040 cardinal rule).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5c.1
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ColumnKind } from '../../bim/types/column-types';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import type { AnchorGhost } from '../../bim/columns/column-anchor-ghosts';
import { ColumnAnchorGhostRenderer } from '../../bim/columns/ColumnAnchorGhostRenderer';

export interface UseColumnGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: ColumnKind;
  readonly transform: ViewTransform;
  /** Projection getter — από `useColumnTool().getGhostFootprints`. */
  getGhostFootprints(cursorPos: Readonly<Point2D> | null): readonly AnchorGhost[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Same viewport-element convention with `useRotationPreview`. Falls back
   *  στο `getCanvas` όταν undefined. */
  getViewportElement?(): HTMLElement | null;
}

export function useColumnGhostPreview(props: Readonly<UseColumnGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, transform, getGhostFootprints, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR-aware clear (mirror useRotationPreview).
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!isAwaitingPosition || !cursorWorld) return;
    const ghosts = getGhostFootprints(cursorWorld);
    if (!ghosts || ghosts.length === 0) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    const renderer = new ColumnAnchorGhostRenderer(ctx);
    renderer.render({ ghosts, kind, transform, viewport });
  }, [isAwaitingPosition, kind, transform, getGhostFootprints, getCanvas, getViewportElement, cursorWorld]);

  // Clear stale ghosts on transition out of awaitingPosition.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isAwaitingPosition) {
      const canvas = getCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    }
    prevActiveRef.current = isAwaitingPosition;
  }, [isAwaitingPosition, getCanvas]);

  // Schedule one draw per cursorWorld / state change while active.
  useEffect(() => {
    if (!isAwaitingPosition) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isAwaitingPosition, drawFrame]);
}
