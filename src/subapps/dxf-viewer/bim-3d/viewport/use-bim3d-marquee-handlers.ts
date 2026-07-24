/**
 * use-bim3d-marquee-handlers — window/crossing rubber-band selection for the 3D viewport (ADR-692 Φ1).
 *
 * Sibling of `use-bim3d-pointer-handlers` (which owns hover + single-click). This hook owns the
 * DRAG gesture: mousedown arms an anchor, past a small threshold it opens a marquee, mouseup
 * resolves the window/crossing hit-set and applies it. While a marquee is active the OrbitControls
 * are suspended (`manager.viewport.setControlsEnabled(false)`) — the same coordination the 3D
 * opening-move drag uses — so the gesture never fights camera pan (ortho left = pan) or tumble.
 *
 * Guards mirror `handleClick`: only a genuine left-drag on the scene canvas, never while Alt is held
 * (tumble/pivot), the «Μέτρηση» tool is active, an edit gizmo is mounted, or Polygon Mode owns clicks.
 *
 * Combine modes (frozen at mousedown):
 *   • plain   → replace   • Shift → add (mirrors 3D shift-click add)   • Ctrl/Cmd → subtract
 *
 * ZERO React on the hot path: the live rectangle lives in `Marquee3DStore` (external store); only
 * the thin `Marquee3DOverlay` leaf repaints (ADR-040 micro-leaf rule).
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { Marquee3DStore } from '../systems/marquee/Marquee3DStore';
import type { MarqueeCombineMode } from '../../systems/selection/marquee-combine';
import { resolveAndApplyMarquee3D } from '../systems/marquee/marquee-3d-apply';
import { disposeMarqueeIdPass } from '../systems/marquee/marquee-gpu-id-pass';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/** Squared px the pointer must travel before a click becomes a marquee (mirrors 2D MIN_MARQUEE_SIZE). */
const DRAG_THRESHOLD_SQ = 16; // 4 px

interface MarqueeDown {
  x: number;
  y: number;
  mode: MarqueeCombineMode;
  dragging: boolean;
}

export interface MarqueeHandlers {
  handleMouseDown: (e: ReactMouseEvent) => void;
  /** Returns TRUE when the marquee consumed the move (caller should skip hover-pick). */
  handleMouseMove: (e: ReactMouseEvent) => boolean;
  handleMouseUp: (e: ReactMouseEvent) => void;
  handleMouseLeave: () => void;
  /** TRUE once after a drag completes, so the trailing `click` doesn't wipe the marquee selection. */
  shouldSuppressClick: () => boolean;
}

export function useBim3DMarqueeHandlers(
  managerRef: RefObject<ThreeJsSceneManager | null>,
): MarqueeHandlers {
  const downRef = useRef<MarqueeDown | null>(null);
  const suppressClickRef = useRef(false);

  const endGesture = useCallback((restoreControls: boolean) => {
    if (restoreControls) managerRef.current?.viewport.setControlsEnabled(true);
    Marquee3DStore.end();
    downRef.current = null;
  }, [managerRef]);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;                 // left button only
    if (e.altKey) return;                       // Alt owns tumble / orbit-pivot
    const manager = managerRef.current;
    if (!manager) return;
    if (e.target !== manager.getRendererCanvas()) return; // only genuine scene canvas (not chrome)
    if (toolStateStore.get().activeTool === 'dist') return; // ADR-680 — «Μέτρηση» owns clicks
    if (useBim3DEditStore.getState().editToolActive) return; // ADR-408 — gizmo owns drags
    if (usePolygonMode3DStore.getState().active) return;     // ADR-539 — face picking owns clicks

    const mode: MarqueeCombineMode = e.shiftKey
      ? 'add'
      : (e.ctrlKey || e.metaKey ? 'subtract' : 'replace');
    downRef.current = { x: e.clientX, y: e.clientY, mode, dragging: false };
    // Suspend camera controls up-front so a left-drag never pans (ortho) or fights tumble.
    manager.viewport.setControlsEnabled(false);
  }, [managerRef]);

  const handleMouseMove = useCallback((e: ReactMouseEvent): boolean => {
    const d = downRef.current;
    if (!d) return false;
    if (!d.dragging) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return true; // still within click slop
      d.dragging = true;
      Marquee3DStore.begin({ x: d.x, y: d.y }, d.mode);
    }
    Marquee3DStore.update({ x: e.clientX, y: e.clientY });
    return true;
  }, []);

  const handleMouseUp = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    const d = downRef.current;
    if (!d) return;
    const manager = managerRef.current;
    if (d.dragging && manager) {
      // ADR-692 Φ2 — BIM meshes ΚΑΙ raw DXF wireframe (όλοι οι ορατοί όροφοι) σε μία ανάλυση·
      // η σειρά εφαρμογής (BIM πρώτα, DXF προσθετικά) ζει στον ενορχηστρωτή.
      resolveAndApplyMarquee3D(
        manager,
        { x: d.x, y: d.y },
        { x: e.clientX, y: e.clientY },
        d.mode,
      );
      suppressClickRef.current = true; // swallow the trailing click
    }
    endGesture(true);
  }, [managerRef, endGesture]);

  const handleMouseLeave = useCallback(() => {
    if (downRef.current) endGesture(true);
  }, [endGesture]);

  const shouldSuppressClick = useCallback((): boolean => {
    const s = suppressClickRef.current;
    suppressClickRef.current = false;
    return s;
  }, []);

  // ADR-692 Φ2 — ο GPU id-pass κρατά render target + id υλικά σε module scope (ένα ανά session,
  // όχι ανά χειρονομία). Ο marquee είναι ο ιδιοκτήτης του, άρα τα ελευθερώνει όταν φεύγει το 3D.
  useEffect(() => disposeMarqueeIdPass, []);

  // Escape cancels an in-flight marquee without changing the selection (CAD convention).
  // Routed through the ADR-364 escape bus — no raw window keydown listener (SSoT: escape-command-bus).
  // BODY_DRAG tier: an in-flight canvas drag that ESC aborts before it can mutate the selection.
  useEscapeHandler({
    id: 'bim3d-marquee-cancel',
    priority: ESC_PRIORITY.BODY_DRAG,
    canHandle: () => downRef.current !== null,
    handle: () => { endGesture(true); return true; },
  });

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, shouldSuppressClick };
}
