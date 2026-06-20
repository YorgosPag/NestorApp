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
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import {
  getCanonicalPreviewFrame,
  type GhostDrawDelegate,
} from '../../systems/preview/ghost-preview-frame';
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
   * React-prop transform — χρησιμοποιείται ΜΟΝΟ ως redraw-trigger (effect dep) ώστε
   * το ghost να επανασχεδιάζεται σε programmatic transform changes (fit/zoom button).
   * Η ΠΡΑΓΜΑΤΙΚΗ τιμή που ζωγραφίζεται είναι το live `getImmediateTransform()` μέσα
   * στο canonical frame (zero-lag, ίδιο με τον main canvas).
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
    isActive, getCanvas, getViewportElement, transform,
    cursorMode = 'world-position', useImmediateSnap = false, clearMode = 'on-gate-exit', draw,
  } = config;

  // SSoT gate (ADR-040): subscribe στο 60fps cursor stream ΜΟΝΟ όσο το preview είναι
  // ενεργό ΚΑΙ ζητείται world cursor. Idle ή cursorMode 'none' → κανένα listener.
  const cursorWorld = useCursorWorldPosition(cursorMode === 'world-position' ? isActive : false);
  const rafRef = useRef<number>(0);
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

    // World cursor mode → χρειάζεται έγκυρο cursor (snapped αν ζητηθεί). 'none' → null.
    let effectiveCursor: Point2D | null = null;
    if (cursorMode === 'world-position') {
      if (!cursorWorld) return;
      if (useImmediateSnap) {
        const snap = getImmediateSnap();
        effectiveCursor =
          snap?.found === true && snap.point != null
            ? { x: snap.point.x, y: snap.point.y }
            : cursorWorld;
      } else {
        effectiveCursor = cursorWorld;
      }
    }

    // Canonical frame — ΜΙΑ πηγή viewport (cached DxfCanvas rect) + transform (live).
    const viewportEl = (getViewportElement?.() ?? canvas) as HTMLCanvasElement;
    const { viewport, transform: liveTransform } = getCanonicalPreviewFrame(viewportEl);

    draw({ ctx, effectiveCursor, viewport, transform: liveTransform });
  }, [isActive, getCanvas, getViewportElement, cursorMode, useImmediateSnap, clearMode, draw, cursorWorld]);

  // Clear-on-exit: σκουπίζει στάλε ghosts όταν το gate κλείνει (ΚΑΙ στα δύο clear modes).
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !isActive) clearCanvas();
    prevActiveRef.current = isActive;
  }, [isActive, clearCanvas]);

  // Schedule ένα draw ανά cursor / state change ενόσω ενεργό. `transform` στις deps =
  // redraw-trigger για programmatic transform changes (η live τιμή διαβάζεται στο draw).
  useEffect(() => {
    if (!isActive) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, drawFrame, transform]);
}
