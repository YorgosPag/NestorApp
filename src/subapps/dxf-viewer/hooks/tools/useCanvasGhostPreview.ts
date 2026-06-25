/**
 * SSOT — useCanvasGhostPreview (ADR-398 §4 — preview-render unification)
 *
 * ΕΝΑ shared harness για ΟΛΑ τα RAF-direct "ghost preview" hooks (column / MEP /
 * opening / rotation / move / mirror / scale / stretch / grip / trim / extend …).
 *
 * Ρίζα που λύνει: ~19 hooks είχαν copy-paste το ΙΔΙΟ scaffolding — cursor-gate +
 * RAF lifecycle + verbatim DPR-clear + `getViewportElement→getBoundingClientRect`
 * viewport read + `getImmediateSnap` snapped-cursor + 2 useEffects. Κάθε αντίγραφο
 * έλυνε ΜΟΝΟ του «ποιο viewport/transform» → απόκλιση (το beam-ghost +Y bug, ADR-398
 * §3.4). Εδώ το scaffolding ζει ΜΙΑ φορά· κάθε hook δίνει ΜΟΝΟ το `draw` delegate +
 * το gate του.
 *
 * Το harness κατέχει ΜΟΝΟ: το cursor subscription gate, το RAF lifecycle (schedule +
 * cancel), το DPR-aware clear, το clear-on-exit, τον υπολογισμό effectiveCursor
 * (snapped αν ζητηθεί), και το canonical preview frame (viewport+transform SSoT,
 * `getCanonicalPreviewFrame`). Καμία domain-specific draw logic — αυτή μένει στο
 * `draw` delegate κάθε hook.
 *
 * @see systems/preview/ghost-preview-frame — το canonical viewport+transform SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
// 🚀 ADR-040 cursor-lag Φ12 — read the live effective-world cursor IMPERATIVELY
// (no useSyncExternalStore → zero React re-render on the leaf) and arm a redraw
// SYNCHRONOUSLY from the same 60fps stream that drives the compositor crosshair.
import {
  getRealtimeWorldCursor,
  subscribeRealtimeWorldCursor,
} from '../../systems/cursor/ImmediatePositionStore';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
// 🏢 ADR-516 — the ONE leading-edge/trailing-flush throttle (REUSE, μηδέν νέο RAF loop).
import { createRafCoalescedThrottle } from '../raf-coalesced-throttle';
import { DXF_TIMING } from '../../config/dxf-timing';
import {
  getCanonicalPreviewFrame,
  type GhostDrawDelegate,
} from '../../systems/preview/ghost-preview-frame';
// 🏢 ADR-040 / ADR-398 §4 — live transform SSoT: zero-lag redraw on mouse-wheel
// zoom/pan (no mousemove). Same store that drives the main canvas → world-locked
// ghost rescales in lockstep (Revit/AutoCAD), no React-prop lag.
import { subscribeTransform } from '../../systems/cursor/ImmediateTransformStore';
// 🏢 SSoT — DPR-aware canvas clear (ADR-084 withCanvasState· αντικαθιστά το idiom
// που ήταν copy-pasted στα 19 ghost hooks + ~5 άλλα σημεία).
import { clearCanvasDpr } from '../../rendering/canvas/withCanvasState';

/**
 * `'world-position'` → το harness subscribe-άρει στο 60fps cursor stream και περνά
 * τον (snapped) world cursor στο `draw`. `'none'` → δεν subscribe-άρει· ο cursor
 * έρχεται αλλιώς (π.χ. `useGripGhostPreview`: μέσω `dragPreview` data), `effectiveCursor`
 * = `null`.
 */
export type GhostCursorMode = 'world-position' | 'none';

/**
 * `'on-gate-exit'` (default) → DPR-clear σε ΚΑΘΕ frame πριν το draw (το κανονικό).
 * `'skip-clear'` → ΟΧΙ per-frame clear (π.χ. `useGripDimAnnotation` ζωγραφίζει layered
 * πάνω στο frame ενός άλλου ghost). Το clear-on-exit γίνεται ΠΑΝΤΑ (και στους δύο).
 */
export type GhostClearMode = 'on-gate-exit' | 'skip-clear';

export interface CanvasGhostPreviewConfig {
  /** Gate — derived boolean· true ⇒ ενεργό preview (ο caller το υπολογίζει). */
  readonly isActive: boolean;
  /** Το canvas-στόχος όπου ζωγραφίζει το ghost (κανονικά το shared PreviewCanvas). */
  getCanvas(): HTMLCanvasElement | null;
  /** Το element για μέτρηση viewport (κανονικά το DxfCanvas)· fallback `getCanvas`. */
  getViewportElement?(): HTMLElement | null;
  /**
   * @deprecated (ADR-398 §4) Ο redraw σε transform change οδηγείται πλέον από το
   * live `subscribeTransform` SSoT (zero-lag, ίδιο store με τον main canvas) — όχι
   * από αυτό το React-prop. Παραμένει στο interface για backward-compat με τους ~19
   * consumers· δεν διαβάζεται πλέον εσωτερικά. Η ΠΡΑΓΜΑΤΙΚΗ τιμή που ζωγραφίζεται
   * είναι το live `getImmediateTransform()` μέσα στο canonical frame.
   */
  readonly transform: ViewTransform;
  /** Default `'world-position'`. */
  readonly cursorMode?: GhostCursorMode;
  /** Default `false` — `true` ⇒ snapped cursor (`getImmediateSnap`) όπως το commit. */
  readonly useImmediateSnap?: boolean;
  /** Default `'on-gate-exit'`. */
  readonly clearMode?: GhostClearMode;
  /** Η domain-specific draw logic του hook (το ΜΟΝΟ που διαφέρει). */
  readonly draw: GhostDrawDelegate;
}

export function useCanvasGhostPreview(config: Readonly<CanvasGhostPreviewConfig>): void {
  const {
    isActive, getCanvas, getViewportElement,
    cursorMode = 'world-position', useImmediateSnap = false, clearMode = 'on-gate-exit', draw,
  } = config;

  const prevActiveRef = useRef<boolean>(false);

  const clearCanvas = useCallback(() => {
    const canvas = getCanvas();
    if (canvas) clearCanvasDpr(canvas);
  }, [getCanvas]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (clearMode !== 'skip-clear') clearCanvasDpr(canvas, ctx);

    if (!isActive) return;

    // World cursor mode → διάβασε τη ΖΩΝΤΑΝΗ effective-world θέση IMPERATIVELY από το
    // SSoT (ADR-040 Φ12) — ΟΧΙ από React snapshot· έτσι το ghost βλέπει ΤΗΝ ΙΔΙΑ τιμή με
    // τον crosshair στο ίδιο frame. Snapped (`getImmediateSnap`) αν ζητηθεί. 'none' → null.
    let effectiveCursor: Point2D | null = null;
    if (cursorMode === 'world-position') {
      const world = getRealtimeWorldCursor();
      if (!world) return;
      if (useImmediateSnap) {
        const snap = getImmediateSnap();
        effectiveCursor =
          snap?.found === true && snap.point != null
            ? { x: snap.point.x, y: snap.point.y }
            : world;
      } else {
        effectiveCursor = world;
      }
    }

    // Canonical frame — ΜΙΑ πηγή viewport (cached DxfCanvas rect) + transform (live).
    const viewportEl = (getViewportElement?.() ?? canvas) as HTMLCanvasElement;
    const { viewport, transform: liveTransform } = getCanonicalPreviewFrame(viewportEl);

    draw({ ctx, effectiveCursor, viewport, transform: liveTransform });
  }, [isActive, getCanvas, getViewportElement, cursorMode, useImmediateSnap, clearMode, draw]);

  // Latest-draw ref so the subscription lifecycle below can stay keyed on
  // [isActive, cursorMode] only (stable through a drag) and never tears down per move.
  const drawFrameRef = useRef(drawFrame);
  drawFrameRef.current = drawFrame;
  // The active throttle's `schedule` — populated while subscribed, no-op otherwise.
  const scheduleRef = useRef<() => void>(() => {});

  // Clear-on-exit: σκουπίζει στάλε ghosts όταν το gate κλείνει (ΚΑΙ στα δύο clear modes).
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isActive) clearCanvas();
    prevActiveRef.current = isActive;
  }, [isActive, clearCanvas]);

  // Subscription lifecycle — keyed on [isActive, cursorMode] (stable during a drag).
  // Arms a SYNCHRONOUS RAF-coalesced draw (ADR-516, leading-edge ⇒ same frame as the
  // event, like the crosshair; trailing flush ⇒ ≤1 redraw/frame) on every realtime
  // effective-world change + every live transform change (wheel zoom/pan w/o mousemove).
  // gating: world subscription ONLY when world-position mode → zero listener in idle/'none'.
  useEffect(() => {
    if (!isActive) return;
    const throttle = createRafCoalescedThrottle(DXF_TIMING.frame.THROTTLE_60);
    const schedule = () => throttle.run(() => drawFrameRef.current());
    scheduleRef.current = schedule;
    schedule(); // initial paint
    const offCursor =
      cursorMode === 'world-position' ? subscribeRealtimeWorldCursor(schedule) : null;
    const offTransform = subscribeTransform(schedule);
    return () => {
      throttle.cancel();
      offCursor?.();
      offTransform();
      scheduleRef.current = () => {};
    };
  }, [isActive, cursorMode]);

  // Redraw when the draw delegate / config changes — covers 'none'-mode consumers
  // whose cursor arrives via the `draw` closure/props (e.g. dim-annotation), plus
  // snap/clear flips. Skips the mount run (the subscription effect already painted).
  const drawDirtyMountedRef = useRef(false);
  useEffect(() => {
    if (!isActive) { drawDirtyMountedRef.current = false; return; }
    if (!drawDirtyMountedRef.current) { drawDirtyMountedRef.current = true; return; }
    scheduleRef.current();
  }, [isActive, drawFrame]);
}
