/**
 * ADR-363 Phase 1C — Wall tool live-preview store.
 *
 * Pattern mirror of `bim/stairs/stair-preview-store.ts` (ADR-358 Phase 8 preview
 * hotfix): the wall tool maintains its own state machine in `useWallTool`
 * (`phase`, `startPoint`, `polylineVertices`, `curveControl`, `overrides`) which
 * is NOT routed through the generic `useUnifiedDrawing.machineContext.points`
 * pipeline — the wall completion semantics differ from line/rectangle/polyline
 * (continuous chain, scene-unit-aware param defaults, validator hardErrors abort).
 * Consequence: `updatePreview` would read an always-empty `tempPoints` array for
 * `tool === 'wall'` and the rubber-band preview / curved control / polyline
 * spine never surfaces.
 *
 * Fix — single-writer, multi-reader module-level store:
 * `useWallTool` writes `startPoint`, optional `curveControl`, optional
 * `polylineVertices`, and current `overrides` on every state transition;
 * `updatePreview` reads via `wallPreviewStore.get()` and passes the
 * reconstructed `tempPoints` tuple to `generateWallPreview`. Zero cross-hook
 * dependency, zero `useSyncExternalStore` on high-frequency stores, ADR-040-safe.
 *
 * Snapshot stability: when nothing changes between two reads, the same frozen
 * object reference is returned — `useSyncExternalStore` relies on this to skip
 * re-render scheduling on subsequent mousemoves.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6 Phase 1C
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.2 §7.2 row 8
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { WallParamOverrides } from '../../hooks/drawing/wall-completion';

export interface WallPreviewState {
  /** First click location (axis start). `null` when wall tool is idle / awaitingStart. */
  readonly startPoint: Point2D | null;
  /**
   * Quadratic Bezier control point for curved walls (3-click flow). `null`
   * until the user clicks the curve handle in the awaitingCurveControl phase.
   */
  readonly curveControl: Point2D | null;
  /**
   * Polyline spine vertices (N-click flow). Empty in straight/curved modes.
   * Captured in user-click order; the active `awaitingNextVertex` cursor is
   * appended at render time by `generateWallPreview`.
   */
  readonly polylineVertices: readonly Point2D[];
  /** Tool overrides (category/height/thickness/flip) — needed to size the preview ghost. */
  readonly overrides: WallParamOverrides;
}

const EMPTY: WallPreviewState = Object.freeze({
  startPoint: null,
  curveControl: null,
  polylineVertices: Object.freeze([]) as readonly Point2D[],
  overrides: Object.freeze({}) as WallParamOverrides,
});

type Listener = () => void;

let currentState: WallPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WallPreviewState {
  return currentState;
}

function getServerSnapshot(): WallPreviewState {
  return EMPTY;
}

function pointsEqual(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

function polylinesEqual(a: readonly Point2D[], b: readonly Point2D[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

function overridesEqual(a: WallParamOverrides, b: WallParamOverrides): boolean {
  if (a === b) return true;
  return (
    a.category === b.category &&
    a.height === b.height &&
    a.thickness === b.thickness &&
    a.flip === b.flip
  );
}

export const wallPreviewStore = {
  /** Writer — called by `useWallTool` on every relevant state transition. */
  set(next: WallPreviewState): void {
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.curveControl, next.curveControl) &&
      polylinesEqual(currentState.polylineVertices, next.polylineVertices) &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      curveControl: next.curveControl ? { x: next.curveControl.x, y: next.curveControl.y } : null,
      polylineVertices: next.polylineVertices.map((p) => ({ x: p.x, y: p.y })),
      overrides: { ...next.overrides },
    };
    for (const l of listeners) l();
  },
  /** Reset back to empty (tool deactivated / idle / commit). */
  reset(): void {
    if (currentState === EMPTY) return;
    currentState = EMPTY;
    for (const l of listeners) l();
  },
  /** Reader (non-React) — escape hatch for tests + `updatePreview` consumer. */
  get(): WallPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest wall-preview state. */
export function useWallPreview(): WallPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
