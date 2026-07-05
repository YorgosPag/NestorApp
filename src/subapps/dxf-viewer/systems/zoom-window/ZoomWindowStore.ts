/**
 * ZoomWindowStore — ADR-374 / ADR-040 compliant singleton.
 *
 * Module-level pub/sub store for the AutoCAD-style "ZOOM Window" tool.
 * Zero React state — mirrors LassoStore + WallSplitStore patterns
 * (ADR-040: high-frequency mouse-move data must not flow through React state).
 *
 * Single-writer: mouse-handler-down / move / up (arms, updates, finishes).
 * Multi-reader:  ZoomWindowSubscriber leaf (paints rubber-band rect via overlay).
 *
 * Snapshot stability: when nothing changes between two reads, the same object
 * reference is returned — `useSyncExternalStore` skips re-renders on no-ops.
 */

import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

// ── Public state ──────────────────────────────────────────────────────────────

export interface ZoomWindowState {
  readonly isActive: boolean;
  readonly isDragging: boolean;
  readonly startPoint: Point2D | null;
  readonly currentPoint: Point2D | null;
  readonly previewRect: { left: number; top: number; width: number; height: number } | null;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const IDLE: ZoomWindowState = Object.freeze({
  isActive: false,
  isDragging: false,
  startPoint: null,
  currentPoint: null,
  previewRect: null,
});

// Minimum screen rectangle (px) — smaller drags are discarded as accidental.
const MIN_ZOOM_RECT_PX = 5;

// ── Module state ──────────────────────────────────────────────────────────────
// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — every mutator
// below keeps its own manual pre-check (identity / threshold), matching the
// hand-rolled store's unconditional `notify()` after each accepted mutation.

const store = createExternalStore<ZoomWindowState>(IDLE);

function getServerSnapshot(): ZoomWindowState { return IDLE; }

function buildRect(a: Point2D, b: Point2D): ZoomWindowState['previewRect'] {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { left, top, width, height };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ZoomWindowStore = {
  /** Arms the drag — called on mousedown when activeTool === 'zoom-window'. */
  start(screenPos: Point2D): void {
    store.set({
      isActive: true,
      isDragging: true,
      startPoint: { x: screenPos.x, y: screenPos.y },
      currentPoint: { x: screenPos.x, y: screenPos.y },
      previewRect: null,
    });
  },

  /** Updates the rubber-band — called on every mousemove during drag. */
  update(screenPos: Point2D): void {
    const current = store.get();
    if (!current.isDragging || !current.startPoint) return;
    const prev = current.currentPoint;
    if (prev && Math.abs(prev.x - screenPos.x) < 1 && Math.abs(prev.y - screenPos.y) < 1) return;
    store.set({
      ...current,
      currentPoint: { x: screenPos.x, y: screenPos.y },
      previewRect: buildRect(current.startPoint, screenPos),
    });
  },

  /**
   * Finalises the drag — returns the final screen-space rect (or null when
   * the user did not drag far enough). Resets state to idle either way.
   */
  finish(): ScreenRect | null {
    const current = store.get();
    if (!current.isDragging || !current.startPoint || !current.currentPoint) {
      if (current !== IDLE) {
        store.set(IDLE);
      }
      return null;
    }
    const a = current.startPoint;
    const b = current.currentPoint;
    const rect: ScreenRect = {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
    store.set(IDLE);
    if (rect.width < MIN_ZOOM_RECT_PX || rect.height < MIN_ZOOM_RECT_PX) return null;
    return rect;
  },

  /** Abort the drag (Escape / right-click / mouse leave). */
  cancel(): void {
    if (store.get() === IDLE) return;
    store.set(IDLE);
  },

  /** True while the drag is in progress. */
  isActive(): boolean { return store.get().isActive; },

  /** Non-React reader (tests + imperative call sites). */
  get(): ZoomWindowState { return store.get(); },

  /** External subscribe — used by useSyncExternalStore in the leaf component. */
  subscribe: store.subscribe,
  getSnapshot: store.get,
  getServerSnapshot,
};
