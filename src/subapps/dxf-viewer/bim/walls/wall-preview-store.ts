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
import type { LinearMemberSnapTarget } from '../framing/linear-member-face-snap';

export interface WallPreviewState {
  /** First click location (axis start). `null` when wall tool is idle / awaitingStart. */
  readonly startPoint: Point2D | null;
  /**
   * ADR-363 Phase 1F — second click location (axis end) for the straight-kind
   * 3-click alignment flow. Set during the `awaitingAlignment` phase so the
   * preview can render the wall from start→endPoint shifted toward the live
   * cursor. `null` in every other phase / kind.
   */
  readonly endPoint: Point2D | null;
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
  /**
   * ADR-508 (2026-06-20) — `true` όταν το `startPoint` κλειδώθηκε από **face-snap** σε
   * κολόνα/μέλος (το ghost-before-click κούμπωσε σε παρειά). Τότε το `startPoint` είναι
   * ΗΔΗ το τελικό centerline → το awaitingEnd preview/commit χρησιμοποιεί centered axis
   * (χωρίς location-line auto-flush που θα ξανα-μετατόπιζε το start). `false` (default) →
   * free placement (auto-flush σε κολόνα / location-line = face).
   */
  readonly startAnchored: boolean;
  /**
   * ADR-508 — column footprints (2Δ) της σκηνής για το 12-θέσεων ghost face snap + flush.
   * Γράφεται από `useWallTool` (`setColumns`, on activate)· διατηρείται μέσα από τα `set()`
   * transitions (αλλάζει σπάνια). `[]` = καμία κολόνα.
   */
  readonly columnFootprints: readonly (readonly Point2D[])[];
  /**
   * ADR-508 unified linear-member framing — τα υφιστάμενα γραμμικά μέλη (τοίχοι+δοκάρια,
   * axis + outline) ώστε το ghost-before-click να κουμπώνει κάθετα (🟢 Τ-framing) ή να
   * γίνεται 🔴 σε ομοαξονικό. Γράφεται από `useWallTool` (`setMembers`). `[]` = κανένα.
   */
  readonly memberTargets: readonly LinearMemberSnapTarget[];
}

const EMPTY: WallPreviewState = Object.freeze({
  startPoint: null,
  endPoint: null,
  curveControl: null,
  polylineVertices: Object.freeze([]) as readonly Point2D[],
  overrides: Object.freeze({}) as WallParamOverrides,
  startAnchored: false,
  columnFootprints: Object.freeze([]) as readonly (readonly Point2D[])[],
  memberTargets: Object.freeze([]) as readonly LinearMemberSnapTarget[],
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

type WallPreviewSet = Omit<WallPreviewState, 'startAnchored' | 'columnFootprints' | 'memberTargets'> & {
  readonly startAnchored?: boolean;
};

export const wallPreviewStore = {
  /**
   * Writer — called by `useWallTool` on every relevant state transition. Τα
   * `columnFootprints` / `memberTargets` ΔΕΝ περνούν εδώ (αλλάζουν σπάνια) —
   * διατηρούνται από το `currentState` (set via `setColumns` / `setMembers`).
   */
  set(next: WallPreviewSet): void {
    const nextAnchored = next.startAnchored ?? false;
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.endPoint, next.endPoint) &&
      pointsEqual(currentState.curveControl, next.curveControl) &&
      polylinesEqual(currentState.polylineVertices, next.polylineVertices) &&
      currentState.startAnchored === nextAnchored &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      endPoint: next.endPoint ? { x: next.endPoint.x, y: next.endPoint.y } : null,
      curveControl: next.curveControl ? { x: next.curveControl.x, y: next.curveControl.y } : null,
      polylineVertices: next.polylineVertices.map((p) => ({ x: p.x, y: p.y })),
      overrides: { ...next.overrides },
      startAnchored: nextAnchored,
      columnFootprints: currentState.columnFootprints,
      memberTargets: currentState.memberTargets,
    };
    for (const l of listeners) l();
  },
  /**
   * ADR-508 — set τα column footprints για το ghost face snap. Idempotent επί ίδιου
   * reference· notify μόνο όταν αλλάζει. Called από `useWallTool` on activate / 1ο κλικ.
   */
  setColumns(footprints: readonly (readonly Point2D[])[]): void {
    if (currentState.columnFootprints === footprints) return;
    currentState = { ...currentState, columnFootprints: footprints };
    for (const l of listeners) l();
  },
  /**
   * ADR-508 — set τα υφιστάμενα γραμμικά μέλη (τοίχοι+δοκάρια) για το ghost face-snap.
   * Idempotent επί ίδιου reference· notify μόνο όταν αλλάζει.
   */
  setMembers(targets: readonly LinearMemberSnapTarget[]): void {
    if (currentState.memberTargets === targets) return;
    currentState = { ...currentState, memberTargets: targets };
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
