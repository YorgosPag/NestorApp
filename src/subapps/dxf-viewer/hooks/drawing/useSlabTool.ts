/**
 * ADR-363 Phase 3 — Slab Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingFirstVertex → awaitingNextVertex (loop) → committed → awaitingFirstVertex
 *
 * Multi-click polygon drawing — Industry convention (AutoCAD PLINE / Revit
 * Slab Sketch): user clicks N times, Enter ή auto-close near the first
 * vertex (50px tolerance) commits the polygon. ESC at any time resets.
 *
 * Continuous draw — μετά από commit ο tool παραμένει σε `awaitingFirstVertex`
 * ώστε ο χρήστης να ξεκινήσει αμέσως νέα πλάκα (mirror useWallTool polyline).
 *
 * SSoT alignment:
 *   - Entity build via `buildSlabEntity` / `buildDefaultSlabParams`
 *     (`hooks/drawing/slab-completion.ts`). ZERO duplicate construction here.
 *   - Pattern alignment με `useWallTool.ts` polyline mode (ref-backed
 *     stateRef + activate/deactivate/reset + Enter keydown listener).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity, SlabKind } from '../../bim/types/slab-types';
import type { Entity } from '../../types/entities';
import {
  buildSlabEntity,
  buildDefaultSlabParams,
  type SlabParamOverrides,
  type SceneUnits,
} from './slab-completion';
import { getDefaultSlabBuildupForKind } from '../../bim/types/slab-dna-types';
import { slabPreviewStore } from '../../bim/slabs/slab-preview-store';
// ADR-404 Phase 5c — publish drawing-mode handle στο ribbon (κεκλιμένη πλάκα «σχεδίασε ήδη κεκλιμένη»).
import { slabToolBridgeStore } from '../../ui/ribbon/hooks/bridge/slab-tool-bridge-store';
// ADR-514 Φ6 — face-snap κορυφών: pre-collect στόχοι στο ΚΟΙΝΟ scene store (SSoT, κοινό με τοίχο/δοκάρι/
// κολώνα) + ο εγκέφαλος-driven polygon-vertex resolver (flush + edge-slide) → preview ≡ commit.
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { useSceneSnapTargetSync } from './use-scene-snap-target-sync';
import { resolvePolygonVertexSnap } from '../../bim/placement/polygon-vertex-snap';
import { polygonVertexLockStore } from '../../bim/placement/polygon-vertex-lock-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type SlabToolPhase =
  | 'idle'
  | 'awaitingFirstVertex'
  | 'awaitingNextVertex';

export interface SlabToolState {
  readonly phase: SlabToolPhase;
  readonly kind: SlabKind;
  readonly vertices: readonly Point2D[];
  readonly overrides: SlabParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: SlabToolState = {
  phase: 'idle',
  kind: 'floor',
  vertices: [],
  overrides: {},
  error: null,
};

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT = 50;

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseSlabToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onSlabCreated?: (entity: SlabEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα slab. */
  readonly currentLevelId?: string;
  /**
   * Optional resolver που επιστρέφει το auto-close tolerance σε world units.
   * Default 50 (mm convention). FSM χρησιμοποιεί την τιμή στο `awaitingNextVertex`
   * για να ανιχνεύσει click κοντά στην πρώτη κορυφή.
   */
  readonly getAutoCloseTolerance?: () => number;
  /** Returns the active scene's coordinate units for correct BOQ calculations. */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * ADR-514 Φ6 — live scene entities για τον face-snap κορυφών (flush σε παρειά τοίχου/κολόνας/
   * δοκαριού/πλάκας). Προ-συλλέγονται στο κοινό `sceneSnapTargetsStore` on activate / entity-created.
   */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseSlabToolResult {
  readonly state: SlabToolState;
  activate(): void;
  setKind(kind: SlabKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click προχώρησε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish ή reset για polygon chain (Enter path). Returns true on commit. */
  finishPolygon(): boolean;
  /** Dynamic Input field overrides (kind / thickness / elevation / reinforcement). */
  setParamOverrides(overrides: SlabParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingFirstVertex: boolean;
  readonly isAwaitingNextVertex: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useSlabTool(options: UseSlabToolOptions = {}): UseSlabToolResult {
  const { onSlabCreated, currentLevelId = '0', getAutoCloseTolerance, getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<SlabToolState>(INITIAL_STATE);
  const stateRef = useRef<SlabToolState>(state);
  stateRef.current = state;

  // ── ADR-514 Φ6 — scene snap targets sync (mirror useColumnTool/useWallTool) ──
  // Pre-collect κολόνες/τοίχοι/δοκάρια/πλάκες στο ΚΟΙΝΟ store ΠΡΙΝ την 1η κορυφή ώστε το flush
  // face-snap (preview + commit) να υπολογίζεται σύγχρονα με έτοιμους στόχους. SSoT hook.
  const refreshSnapTargets = useSceneSnapTargetSync(() => getSceneEntities?.() ?? []);

  // ── preview store sync (ADR-363 Phase 6.5.B) ─────────────────────────────
  useEffect(() => {
    if (state.phase === 'idle') {
      slabPreviewStore.reset();
      return;
    }
    slabPreviewStore.set({ vertices: state.vertices, overrides: state.overrides });
  }, [state]);

  useEffect(() => {
    return () => slabPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    refreshSnapTargets(); // ADR-514 Φ6 — στόχοι έτοιμοι πριν την 1η κορυφή
    polygonVertexLockStore.reset(); // καθαρό edge-slide state σε νέα σχεδίαση
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: 'awaitingFirstVertex',
    }));
  }, [refreshSnapTargets]);

  const setKind = useCallback((kind: SlabKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      overrides: { ...prev.overrides, kind },
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
    }));
  }, []);

  const deactivate = useCallback(() => {
    sceneSnapTargetsStore.reset(); // ADR-514 Φ6 — καθάρισε τους face-snap στόχους
    polygonVertexLockStore.reset();
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    polygonVertexLockStore.reset(); // ESC → νέο πολύγωνο, καθαρό edge-slide
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingFirstVertex',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: SlabParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── ADR-404 Phase 5c — publish handle στο ribbon bridge store ─────────────
  // Single writer (mirror wallToolBridgeStore). Ο bridge διαβάζει μέσω
  // `slabToolBridgeStore.get()` όταν δεν υπάρχει επιλεγμένη πλάκα, ώστε το panel
  // «Κλίση» να οδηγεί τα overrides σε drawing mode (η επόμενη πλάκα born-sloped).
  useEffect(() => {
    slabToolBridgeStore.set({
      isActive: state.phase !== 'idle',
      overrides: state.overrides,
      setParamOverrides,
    });
    return () => {
      // Καθάρισε μόνο αν είμαστε ο τρέχων publisher (μην σβήσεις νεότερο mount).
      if (slabToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        slabToolBridgeStore.set(null);
      }
    };
  }, [state.phase, state.overrides, setParamOverrides]);

  // ── commit ───────────────────────────────────────────────────────────────
  /**
   * Build + commit slab από fully-resolved vertex list. Validator hardError
   * αναιρεί το commit silently — FSM παραμένει σε awaitingNextVertex ώστε
   * ο χρήστης να διορθώσει.
   */
  const commitFromState = useCallback((s: SlabToolState): boolean => {
    if (s.vertices.length < 3) return false;
    // ADR-412 «type always wins» — a slab drawn with the kind's default cross-
    // section gets the per-kind composite build-up (Revit: drawing a floor
    // applies the active floor type), so `buildSlabEntity` auto-links it to the
    // read-only built-in slab type and the per-layer 3D rendering activates. An
    // explicit thickness override = ad-hoc single-material slab (no DNA, untyped)
    // — mirrors the wall «explicit thickness ⇒ manual wall» rule.
    const overridesWithKind: SlabParamOverrides = {
      ...s.overrides,
      kind: s.kind,
      dna:
        s.overrides.dna ??
        (s.overrides.thickness === undefined
          ? getDefaultSlabBuildupForKind(s.kind)
          : undefined),
    };
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const params = buildDefaultSlabParams(s.vertices, overridesWithKind, sceneUnits);
    const result = buildSlabEntity(params, currentLevelId);
    if (!result.ok) {
      setState({ ...s, error: result.hardErrors[0] ?? null });
      return false;
    }
    onSlabCreated?.(result.entity);
    polygonVertexLockStore.reset(); // ADR-514 Φ6 — νέο πολύγωνο ξεκινά με καθαρό edge-slide
    setState({
      ...INITIAL_STATE,
      kind: s.kind,
      overrides: s.overrides,
      phase: 'awaitingFirstVertex',
    });
    return true;
  }, [currentLevelId, onSlabCreated, getSceneUnits]);

  // ── ADR-514 Φ6 — face-snap κορυφής (flush + edge-slide) + ενημέρωση lock για την επόμενη ──
  // ΙΔΙΟΣ resolver + ΙΔΙΟ store με το preview (`drawing-preview-generator` slab/roof branch) →
  // preview ≡ commit by construction. Ο `point` έρχεται ήδη OSNAP-snapped κεντρικά (anti double-snap).
  const snapVertex = useCallback((point: Readonly<Point2D>): Point2D => {
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const snap = resolvePolygonVertexSnap(point, sceneSnapTargetsStore.get(), sceneUnits, polygonVertexLockStore.get() ?? undefined);
    polygonVertexLockStore.set(snap.faceFrame ? { faceFrame: snap.faceFrame, targetId: snap.targetId } : null);
    return snap.point;
  }, [getSceneUnits]);

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingFirstVertex') {
        const v = snapVertex(point);
        setState({
          ...s,
          phase: 'awaitingNextVertex',
          vertices: [v],
          error: null,
        });
        return true;
      }

      if (s.phase === 'awaitingNextVertex') {
        // Auto-close: click κοντά στην πρώτη κορυφή με ≥3 vertices → commit. Ελέγχεται στο RAW
        // (ήδη OSNAP-snapped) σημείο ΠΡΙΝ τον face-snap, ώστε ο face-snap να μην «τραβά» την
        // κορυφή κλεισίματος μακριά από την 1η (το endpoint OSNAP νικά στο κλείσιμο).
        if (s.vertices.length >= 3) {
          const first = s.vertices[0];
          const dx = point.x - first.x;
          const dy = point.y - first.y;
          const tol = getAutoCloseTolerance?.() ?? SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT;
          if (Math.hypot(dx, dy) <= tol) {
            return commitFromState(s);
          }
        }
        const v = snapVertex(point);
        setState({
          ...s,
          vertices: [...s.vertices, v],
          error: null,
        });
        return true;
      }

      return false;
    },
    [commitFromState, getAutoCloseTolerance, snapVertex],
  );

  const finishPolygon = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitFromState(s);
  }, [commitFromState]);

  // ── status text (i18n keys) ──────────────────────────────────────────────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingFirstVertex':
        return 'tools.slab.statusFirstVertex';
      case 'awaitingNextVertex':
        return 'tools.slab.statusNextVertex';
      default:
        return '';
    }
  }, []);

  // ── Enter to commit polygon (ADR-363 Phase 5.5c) ─────────────────────────
  // ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration 2026-05-19).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingNextVertex') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
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
    state,
    activate,
    setKind,
    deactivate,
    reset,
    onCanvasClick,
    finishPolygon,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingFirstVertex: state.phase === 'awaitingFirstVertex',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
  };
}
