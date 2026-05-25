/**
 * ADR-363 Phase 3.7b+ — Slab-opening placement ghost preview hook (RAF-driven).
 *
 * Mirror του `useColumnGhostPreview` pattern (Phase 4.5c.4): micro-leaf consumer
 * που subscribes σε `useCursorWorldPosition` και ζωγραφίζει ένα rectangle ghost
 * απευθείας στο preview canvas. Ζωντάνεμα μέσω RAF — δεν προκαλεί React
 * re-renders πάνω από αυτό το leaf.
 *
 * Phase 3.7b++ extension: when `hoveredEdgeMidpointGrip` is set, draws a green
 * "+vertex" indicator at the grip world position (pre-drag hover affordance).
 *
 * ADR-040 compliance:
 *   - NO `useSyncExternalStore` σε orchestrators
 *   - `getImmediateSnap()` imperative read inside RAF callback
 *   - Ghost renders to preview canvas only (bitmap cache unchanged)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { SlabOpeningKind } from '../../bim/types/slab-opening-types';
import { SLAB_OPENING_DEFAULT_SIZES } from '../../bim/types/slab-opening-types';
import type { SlabOpeningParamOverrides } from '../drawing/slab-opening-completion';
import type { UnifiedGripInfo } from '../grips/unified-grip-types';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { SlabOpeningGhostRenderer } from '../../bim/slab-openings/slab-opening-ghost-renderer';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

export interface UseSlabOpeningGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: SlabOpeningKind;
  /** Width/depth from ribbon overrides — falls back to kind defaults. */
  readonly overrides: SlabOpeningParamOverrides;
  /** ADR-363 Phase 3.7b++ — pre-drag hover indicator for edge-midpoint grips. */
  readonly hoveredEdgeMidpointGrip?: UnifiedGripInfo | null;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /**
   * ADR-370 — active scene units. Defaults (mm-baked) are converted into
   * scene coords via `mmToSceneUnits(units)` ώστε το ghost να συμπίπτει με
   * το committed entity rectangle (mirror του builder σε
   * `buildDefaultSlabOpeningParams`). Όταν undefined → 'mm' fallback.
   */
  getSceneUnits?(): SceneUnits;
}

export function useSlabOpeningGhostPreview(props: Readonly<UseSlabOpeningGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, overrides, hoveredEdgeMidpointGrip, transform, getCanvas, getViewportElement, getSceneUnits } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    // --- Placement ghost ---
    if (isAwaitingPosition && cursorWorld) {
      const snapState = getImmediateSnap();
      const effectiveCursor: Point2D =
        snapState?.found === true && snapState.point != null ? snapState.point : cursorWorld;
      const defaults = SLAB_OPENING_DEFAULT_SIZES[kind];
      // ADR-370 — defaults σε mm. Convert σε scene-units ώστε το ghost
      // rectangle να συμπίπτει με το rectangle που θα φτιάξει ο builder στο
      // commit (1.5 m σε scene 'm', 1500 mm σε scene 'mm', κτλ.). Χωρίς αυτό
      // το conversion το ghost εμφανίζεται ~1000× μεγαλύτερο σε scene 'm'.
      const mmFactor = mmToSceneUnits(getSceneUnits?.() ?? 'mm');
      const halfW = ((overrides.width ?? defaults.width) / 2) * mmFactor;
      const halfD = ((overrides.depth ?? defaults.depth) / 2) * mmFactor;
      const cx = effectiveCursor.x;
      const cy = effectiveCursor.y;
      const vertices = [
        { x: cx - halfW, y: cy - halfD },
        { x: cx + halfW, y: cy - halfD },
        { x: cx + halfW, y: cy + halfD },
        { x: cx - halfW, y: cy + halfD },
      ] as const;
      new SlabOpeningGhostRenderer(ctx).render({ vertices, kind, transform, viewport });
    }

    // --- Edge-midpoint hover indicator ---
    if (hoveredEdgeMidpointGrip) {
      const sp = CoordinateTransforms.worldToScreen(hoveredEdgeMidpointGrip.position, transform, viewport);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 120, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', sp.x, sp.y);
    }
  }, [isAwaitingPosition, kind, overrides, hoveredEdgeMidpointGrip, transform, getCanvas, getViewportElement, cursorWorld, getSceneUnits]);

  // Clear stale ghost on transition to fully inactive state.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    const isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null;
    if (wasActive && !isActive) {
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
    prevActiveRef.current = isActive;
  }, [isAwaitingPosition, hoveredEdgeMidpointGrip, getCanvas]);

  // Schedule one draw per cursor / state change while active.
  useEffect(() => {
    const isActive = isAwaitingPosition || hoveredEdgeMidpointGrip != null;
    if (!isActive) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isAwaitingPosition, hoveredEdgeMidpointGrip, drawFrame]);
}
