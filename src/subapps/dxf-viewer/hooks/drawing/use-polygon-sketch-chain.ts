/**
 * ADR-363 — Canonical polygon-sketch **vertex-chain FSM** (shared SSoT primitive).
 *
 * Big-player pattern (Revit *Sketch Mode* / Figma pen / Cinema4D spline): ΕΝΑ κοινό
 * sketch engine για ΟΛΑ τα εργαλεία που σχεδιάζουν κλειστό περίγραμμα με διαδοχικά
 * κλικ — όχι ξεχωριστό polygon-draw ανά εργαλείο. Εξήχθη verbatim από το vertex-chain
 * του `useSlabTool` (πρώτος consumer)· ο 2ος consumer είναι η «Κολώνα από πολύγωνο»
 * (`useColumnTool` placementMode='polygon').
 *
 * State machine (ίδιο με slab):
 *   idle → awaitingFirstVertex → awaitingNextVertex (loop) → onCommit → awaitingFirstVertex
 *
 * Multi-click polygon drawing — Industry convention (AutoCAD PLINE / Revit Sketch):
 * ο χρήστης κλικάρει N φορές, Enter ή auto-close κοντά στην 1η κορυφή (tolerance)
 * κάνει commit το πολύγωνο. ESC κάνει reset (χειρισμός κεντρικά μέσω EscapeCommandBus).
 *
 * Ownership boundary: το primitive owns ΜΟΝΟ `phase + vertices` + τον face-snap κορυφής
 * (flush + edge-slide, preview ≡ commit). Ο consumer κρατά το δικό του domain state
 * (kind/overrides/error) και δημοσιεύει το δικό του live-preview store σε useEffect πάνω
 * στα `phase`/`vertices` που εκθέτει το primitive.
 *
 * SSoT reuse:
 *   - `resolvePolygonVertexSnap` + `polygonVertexLockStore` (ADR-514 Φ6) — ΙΔΙΟΣ resolver
 *     & store με το preview path (`drawing-preview-generator` slab/roof branch) → preview
 *     ≡ commit by construction.
 *   - `useSceneSnapTargetSync` — pre-collect κολόνες/τοίχοι/δοκάρια/πλάκες στο ΚΟΙΝΟ
 *     `sceneSnapTargetsStore` πριν την 1η κορυφή.
 *   - ADR-040 micro-leaf compliance: hook owns React state, μηδέν `useSyncExternalStore`
 *     σε high-frequency stores.
 *
 * @see ./useSlabTool.ts — 1ος consumer
 * @see ./useColumnTool.ts — 2ος consumer (placementMode='polygon')
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §column-polygon-sketch
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from './slab-completion';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
import { resolvePolygonVertexSnap } from '../../bim/placement/polygon-vertex-snap';
import { polygonVertexLockStore } from '../../bim/placement/polygon-vertex-lock-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type PolygonSketchPhase = 'idle' | 'awaitingFirstVertex' | 'awaitingNextVertex';

/** World-units auto-close tolerance — caller scales by view zoom αν χρειαστεί. */
export const POLYGON_SKETCH_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

interface PolygonSketchState {
  readonly phase: PolygonSketchPhase;
  readonly vertices: readonly Point2D[];
}

const INITIAL_STATE: PolygonSketchState = {
  phase: 'idle',
  vertices: [],
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UsePolygonSketchChainOptions {
  /**
   * Build + commit από την πλήρη λίστα κορυφών. `true` = επιτυχία → το primitive
   * κάνει reset σε awaitingFirstVertex (continuous draw). `false` = ο validator
   * απέρριψε → το primitive ΜΕΝΕΙ σε awaitingNextVertex ώστε ο χρήστης να διορθώσει.
   */
  readonly onCommit: (vertices: readonly Point2D[]) => boolean;
  /** Active scene coordinate units (mm→canvas) — περνά στον vertex face-snap. */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * Live scene entities για τον face-snap κορυφών (flush σε παρειά μέλους). Προ-
   * συλλέγονται στο κοινό `sceneSnapTargetsStore` on activate. Omit ⇒ μόνο OSNAP.
   */
  readonly getSceneEntities?: () => readonly Entity[];
  /** Resolver για auto-close tolerance (world units). Default 50. */
  readonly getAutoCloseTolerance?: () => number;
  /** Ελάχιστες κορυφές για έγκυρο κλείσιμο (default 3). */
  readonly minVertices?: number;
}

export interface UsePolygonSketchChainResult {
  readonly phase: PolygonSketchPhase;
  readonly vertices: readonly Point2D[];
  activate(): void;
  reset(): void;
  deactivate(): void;
  /** Returns true αν το click προχώρησε/commit-άρισε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function usePolygonSketchChain(
  options: UsePolygonSketchChainOptions,
): UsePolygonSketchChainResult {
  const { onCommit, getSceneUnits, getSceneEntities, getAutoCloseTolerance, minVertices = 3 } =
    options;

  const [state, setState] = useState<PolygonSketchState>(INITIAL_STATE);
  const stateRef = useRef<PolygonSketchState>(state);
  stateRef.current = state;

  // Latest callbacks χωρίς να «καίμε» την ταυτότητα των click handlers (stable refs).
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // ── ADR-514 Φ6 — scene snap targets sync (κοινό με slab/column/wall) ──
  const refreshSnapTargets = useSceneSnapTargetSync(() => getSceneEntities?.() ?? []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    refreshSnapTargets(); // στόχοι έτοιμοι πριν την 1η κορυφή
    polygonVertexLockStore.reset(); // καθαρό edge-slide state σε νέα σχεδίαση
    setState({ phase: 'awaitingFirstVertex', vertices: [] });
  }, [refreshSnapTargets]);

  const deactivate = useCallback(() => {
    sceneSnapTargetsStore.reset(); // καθάρισε τους face-snap στόχους
    polygonVertexLockStore.reset();
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    polygonVertexLockStore.reset(); // ESC → νέο πολύγωνο, καθαρό edge-slide
    setState((prev) => ({
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
      vertices: [],
    }));
  }, []);

  // ── ADR-514 Φ6 — face-snap κορυφής (flush + edge-slide) + ενημέρωση lock ──
  // ΙΔΙΟΣ resolver + ΙΔΙΟ store με το preview → preview ≡ commit by construction. Ο
  // `point` έρχεται ήδη OSNAP-snapped κεντρικά (anti double-snap).
  const snapVertex = useCallback((point: Readonly<Point2D>): Point2D => {
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const snap = resolvePolygonVertexSnap(
      point,
      sceneSnapTargetsStore.get(),
      sceneUnits,
      polygonVertexLockStore.get() ?? undefined,
    );
    polygonVertexLockStore.set(
      snap.faceFrame ? { faceFrame: snap.faceFrame, targetId: snap.targetId } : null,
    );
    return snap.point;
  }, [getSceneUnits]);

  // ── commit ─────────────────────────────────────────────────────────────────
  const commitFromState = useCallback((s: PolygonSketchState): boolean => {
    if (s.vertices.length < minVertices) return false;
    const ok = onCommitRef.current(s.vertices);
    if (!ok) return false;
    polygonVertexLockStore.reset(); // νέο πολύγωνο ξεκινά με καθαρό edge-slide
    setState({ phase: 'awaitingFirstVertex', vertices: [] });
    return true;
  }, [minVertices]);

  // ── click pipeline ─────────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingFirstVertex') {
        const v = snapVertex(point);
        setState({ phase: 'awaitingNextVertex', vertices: [v] });
        return true;
      }

      if (s.phase === 'awaitingNextVertex') {
        // Auto-close: click κοντά στην 1η κορυφή με ≥minVertices → commit. Ελέγχεται στο
        // RAW (ήδη OSNAP-snapped) σημείο ΠΡΙΝ τον face-snap, ώστε ο face-snap να μην
        // «τραβά» την κορυφή κλεισίματος μακριά από την 1η (endpoint OSNAP νικά στο κλείσιμο).
        if (s.vertices.length >= minVertices) {
          const first = s.vertices[0];
          const dx = point.x - first.x;
          const dy = point.y - first.y;
          const tol = getAutoCloseTolerance?.() ?? POLYGON_SKETCH_AUTO_CLOSE_TOLERANCE_DEFAULT;
          if (Math.hypot(dx, dy) <= tol) {
            return commitFromState(s);
          }
        }
        const v = snapVertex(point);
        setState({ phase: 'awaitingNextVertex', vertices: [...s.vertices, v] });
        return true;
      }

      return false;
    },
    [commitFromState, getAutoCloseTolerance, minVertices, snapVertex],
  );

  const finishPolygon = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitFromState(s);
  }, [commitFromState]);

  // ── Enter to commit polygon ──────────────────────────────────────────────────
  // ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingNextVertex') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const ok = commitFromState(s);
      if (ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [commitFromState]);

  return {
    phase: state.phase,
    vertices: state.vertices,
    activate,
    reset,
    deactivate,
    onCanvasClick,
    finishPolygon,
    isActive: state.phase !== 'idle',
    isAwaitingFirstVertex: state.phase === 'awaitingFirstVertex',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
  };
}
