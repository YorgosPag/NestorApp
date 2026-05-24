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

type Listener = () => void;
let current: ZoomWindowState = IDLE;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): ZoomWindowState { return current; }
function getServerSnapshot(): ZoomWindowState { return IDLE; }

function notify(): void {
  for (const l of listeners) l();
}

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
    current = {
      isActive: true,
      isDragging: true,
      startPoint: { x: screenPos.x, y: screenPos.y },
      currentPoint: { x: screenPos.x, y: screenPos.y },
      previewRect: null,
    };
    notify();
  },

  /** Updates the rubber-band — called on every mousemove during drag. */
  update(screenPos: Point2D): void {
    if (!current.isDragging || !current.startPoint) return;
    const prev = current.currentPoint;
    if (prev && Math.abs(prev.x - screenPos.x) < 1 && Math.abs(prev.y - screenPos.y) < 1) return;
    current = {
      ...current,
      currentPoint: { x: screenPos.x, y: screenPos.y },
      previewRect: buildRect(current.startPoint, screenPos),
    };
    notify();
  },

  /**
   * Finalises the drag — returns the final screen-space rect (or null when
   * the user did not drag far enough). Resets state to idle either way.
   */
  finish(): ScreenRect | null {
    if (!current.isDragging || !current.startPoint || !current.currentPoint) {
      if (current !== IDLE) {
        current = IDLE;
        notify();
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
    current = IDLE;
    notify();
    if (rect.width < MIN_ZOOM_RECT_PX || rect.height < MIN_ZOOM_RECT_PX) return null;
    return rect;
  },

  /** Abort the drag (Escape / right-click / mouse leave). */
  cancel(): void {
    if (current === IDLE) return;
    current = IDLE;
    notify();
  },

  /** True while the drag is in progress. */
  isActive(): boolean { return current.isActive; },

  /** Non-React reader (tests + imperative call sites). */
  get(): ZoomWindowState { return current; },

  /** External subscribe — used by useSyncExternalStore in the leaf component. */
  subscribe,
  getSnapshot,
  getServerSnapshot,
};
