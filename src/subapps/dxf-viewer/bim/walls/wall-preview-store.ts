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
import type { StripJustification } from '../types/foundation-types';
import type { WallArcVariant } from '../types/wall-types';

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
   * ADR-565 — for a curved (circular-arc) wall, the FIXED end point (2nd click)
   * during the `awaitingCurveControl` phase. When set, the live cursor is the
   * on-arc "through" point and the preview shows the arc `start → cursor → end`.
   * `null` in every other phase / kind.
   */
  readonly arcEndPoint: Point2D | null;
  /**
   * ADR-565 Φ1.x — active arc draw-variant (Draw gallery). Το preview branch-άρει πάνω σ' αυτό:
   * 'center-ends' → arc από `arcCenter`+start+cursor· 'tangent' → arc εφαπτομενικό στο προηγ.
   * τμήμα· '3-point'/'start-end-radius' → μέσω `arcEndPoint`. Default '3-point'.
   */
  readonly arcVariant: WallArcVariant;
  /**
   * ADR-565 Φ1.x — «κέντρο-άκρα» variant: το κέντρο του τόξου (1ο κλικ). Set κατά το
   * `awaitingArcRadiusPoint` ώστε το live preview να δείξει το τόξο start→(projected cursor).
   * `null` στα υπόλοιπα variants / phases.
   */
  readonly arcCenter: Point2D | null;
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
   * ADR-508 §end-reference — Revit location-line justification όταν το `startPoint` κλείδωσε με end-cap
   * 3-tier snap (κορυφή τοίχου). Το awaitingEnd ghost το μετατρέπει σε alignmentPoint ώστε το σώμα να
   * «κρέμεται» στη σωστή παρειά (preview ≡ commit). `null` σε free / body T-framing / overlap / center.
   */
  readonly startJustification: StripJustification | null;
  /**
   * ADR-508 (2026-06-21) — γωνία (μοίρες, world) της κάθετης-στην-παρειά κατεύθυνσης όταν το
   * `startPoint` κλειδώθηκε από face-snap (`end - start` του ghost). Τροφοδοτεί το relative-polar
   * του 2ου κλικ (preview === commit): `getBimOrthoReference('wall')` δίνει το ref (= start) και το
   * `resolveWallFaceRelativePolar` διαβάζει αυτό το πεδίο. `null` = free / collinear-overlap.
   */
  readonly startFaceAngle: number | null;
  /**
   * ADR-508 §opening-conflict — id του host μέλους όπου κούμπωσε το `startPoint` (snapped reference).
   * Το awaitingEnd ghost ελέγχει αν κόβει άνοιγμα ΑΥΤΟΥ του host (μηδέν re-derive). `null` = free.
   */
  readonly anchoredHostId: string | null;
  // ADR-398 §3.10 — οι face-snap στόχοι (column footprints + γραμμικά μέλη) ΜΕΤΑΚΙΝΗΘΗΚΑΝ στο
  // κοινό `sceneSnapTargetsStore` (bim/framing/scene-snap-targets.ts) — ΕΝΑ SSoT για όλα τα
  // placement tools. Αυτό το store κρατά πλέον ΜΟΝΟ το wall-tool FSM state.
}

const EMPTY: WallPreviewState = Object.freeze({
  startPoint: null,
  endPoint: null,
  curveControl: null,
  arcEndPoint: null,
  arcVariant: '3-point' as WallArcVariant,
  arcCenter: null,
  polylineVertices: Object.freeze([]) as readonly Point2D[],
  overrides: Object.freeze({}) as WallParamOverrides,
  startAnchored: false,
  startJustification: null,
  startFaceAngle: null,
  anchoredHostId: null,
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

type WallPreviewSet = Omit<WallPreviewState, 'startAnchored' | 'startJustification' | 'startFaceAngle' | 'anchoredHostId' | 'arcEndPoint' | 'arcVariant' | 'arcCenter'> & {
  readonly startAnchored?: boolean;
  readonly startJustification?: StripJustification | null;
  readonly startFaceAngle?: number | null;
  readonly anchoredHostId?: string | null;
  readonly arcEndPoint?: Point2D | null;
  readonly arcVariant?: WallArcVariant;
  readonly arcCenter?: Point2D | null;
};

export const wallPreviewStore = {
  /** Writer — called by `useWallTool` on every relevant state transition (FSM state only). */
  set(next: WallPreviewSet): void {
    const nextAnchored = next.startAnchored ?? false;
    const nextJustification = next.startJustification ?? null;
    const nextFaceAngle = next.startFaceAngle ?? null;
    const nextHostId = next.anchoredHostId ?? null;
    const nextArcEnd = next.arcEndPoint ?? null;
    const nextArcVariant = next.arcVariant ?? '3-point';
    const nextArcCenter = next.arcCenter ?? null;
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.endPoint, next.endPoint) &&
      pointsEqual(currentState.curveControl, next.curveControl) &&
      pointsEqual(currentState.arcEndPoint, nextArcEnd) &&
      pointsEqual(currentState.arcCenter, nextArcCenter) &&
      currentState.arcVariant === nextArcVariant &&
      polylinesEqual(currentState.polylineVertices, next.polylineVertices) &&
      currentState.startAnchored === nextAnchored &&
      currentState.startJustification === nextJustification &&
      currentState.startFaceAngle === nextFaceAngle &&
      currentState.anchoredHostId === nextHostId &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      endPoint: next.endPoint ? { x: next.endPoint.x, y: next.endPoint.y } : null,
      curveControl: next.curveControl ? { x: next.curveControl.x, y: next.curveControl.y } : null,
      arcEndPoint: nextArcEnd ? { x: nextArcEnd.x, y: nextArcEnd.y } : null,
      arcVariant: nextArcVariant,
      arcCenter: nextArcCenter ? { x: nextArcCenter.x, y: nextArcCenter.y } : null,
      polylineVertices: next.polylineVertices.map((p) => ({ x: p.x, y: p.y })),
      overrides: { ...next.overrides },
      startAnchored: nextAnchored,
      startJustification: nextJustification,
      startFaceAngle: nextFaceAngle,
      anchoredHostId: nextHostId,
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
  /** Non-React subscription (parity με `useWallPreview`) — για readers εκτός React (ADR-513 ring config). */
  subscribe,
};

/** React subscription. Returns the latest wall-preview state. */
export function useWallPreview(): WallPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * ADR-513 — `true` όταν το εργαλείο τοίχου είναι σε `awaitingEnd` (έγινε το 1ο κλικ, εκκρεμεί το 2ο):
 * ο ΕΝΑΣ gate για το live «Δαχτυλίδι Εντολών» / dynamic-input overlay. Κοινή SSoT πηγή για τον 2D
 * `DynamicInputSubscriber` και τον 3D `DynamicInput3DLeaf` ώστε το κριτήριο να μην αποκλίνει ποτέ.
 */
export function isWallAwaitingEnd(activeTool: string, preview: WallPreviewState): boolean {
  return activeTool === 'wall' && preview.startPoint !== null && preview.endPoint === null;
}
