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
 *   - Vertex-chain FSM (φάσεις + auto-close + Enter + face-snap κορυφής) delegated
 *     στο ΚΟΙΝΟ `usePolygonSketchChain` primitive (canonical sketch engine, ADR-363
 *     §column-polygon-sketch). Το slab είναι ο 1ος consumer· owns μόνο kind/overrides/
 *     error + build/commit + preview publish. ZERO duplicate FSM.
 *   - Entity build via `buildSlabEntity` / `buildDefaultSlabParams`
 *     (`hooks/drawing/slab-completion.ts`). ZERO duplicate construction here.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see ./use-polygon-sketch-chain.ts — κοινό vertex-chain FSM primitive
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
// ADR-363 §column-polygon-sketch — κοινό vertex-chain FSM (canonical sketch engine).
import {
  usePolygonSketchChain,
  POLYGON_SKETCH_AUTO_CLOSE_TOLERANCE_DEFAULT,
} from './use-polygon-sketch-chain';

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

/** World-units snap tolerance — caller scales by view zoom αν χρειαστεί. */
export const SLAB_AUTO_CLOSE_TOLERANCE_DEFAULT = POLYGON_SKETCH_AUTO_CLOSE_TOLERANCE_DEFAULT;

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

  // Slab-owned domain state (το phase+vertices ζουν στο κοινό chain primitive).
  const [kind, setKindState] = useState<SlabKind>('floor');
  const [overrides, setOverrides] = useState<SlabParamOverrides>({});
  const [error, setError] = useState<string | null>(null);

  // Latest kind/overrides χωρίς να «καίμε» την ταυτότητα του onCommit (stable ref).
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  // ── commit — build + commit από fully-resolved vertex list ────────────────
  // Validator hardError αναιρεί το commit (returns false) — το chain primitive
  // μένει σε awaitingNextVertex ώστε ο χρήστης να διορθώσει.
  const onCommit = useCallback((vertices: readonly Point2D[]): boolean => {
    // ADR-412 «type always wins» — a slab drawn with the kind's default cross-
    // section gets the per-kind composite build-up (Revit: drawing a floor
    // applies the active floor type). An explicit thickness override = ad-hoc
    // single-material slab (no DNA, untyped) — mirrors the wall rule.
    const overridesWithKind: SlabParamOverrides = {
      ...overridesRef.current,
      kind: kindRef.current,
      dna:
        overridesRef.current.dna ??
        (overridesRef.current.thickness === undefined
          ? getDefaultSlabBuildupForKind(kindRef.current)
          : undefined),
    };
    const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
    const params = buildDefaultSlabParams(vertices, overridesWithKind, sceneUnits);
    const result = buildSlabEntity(params, currentLevelId);
    if (!result.ok) {
      setError(result.hardErrors[0] ?? null);
      return false;
    }
    setError(null);
    onSlabCreated?.(result.entity);
    return true;
  }, [currentLevelId, onSlabCreated, getSceneUnits]);

  const chain = usePolygonSketchChain({
    onCommit,
    getSceneUnits,
    getSceneEntities,
    getAutoCloseTolerance,
  });
  // Destructure σταθερά members (useCallback στο primitive) → stable deps στους wrappers.
  const {
    phase,
    vertices: chainVertices,
    activate: chainActivate,
    reset: chainReset,
    deactivate: chainDeactivate,
    onCanvasClick: chainOnCanvasClick,
    finishPolygon: chainFinishPolygon,
  } = chain;

  // ── composed public state (backward-compat shape) ─────────────────────────
  const state: SlabToolState = useMemo(
    () => ({ phase, kind, vertices: chainVertices, overrides, error }),
    [phase, kind, chainVertices, overrides, error],
  );

  // ── preview store sync (ADR-363 Phase 6.5.B) ─────────────────────────────
  useEffect(() => {
    if (phase === 'idle') {
      slabPreviewStore.reset();
      return;
    }
    slabPreviewStore.set({ vertices: chainVertices, overrides });
  }, [phase, chainVertices, overrides]);

  useEffect(() => {
    return () => slabPreviewStore.reset();
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setError(null);
    chainActivate();
  }, [chainActivate]);

  const setKind = useCallback((next: SlabKind) => {
    setKindState(next);
    setOverrides((prev) => ({ ...prev, kind: next }));
    setError(null);
    chainReset();
  }, [chainReset]);

  const deactivate = useCallback(() => {
    setError(null);
    chainDeactivate();
  }, [chainDeactivate]);

  const reset = useCallback(() => {
    setError(null);
    chainReset();
  }, [chainReset]);

  const setParamOverrides = useCallback((next: SlabParamOverrides) => {
    setOverrides((prev) => ({ ...prev, ...next }));
  }, []);

  const finishPolygon = useCallback((): boolean => chainFinishPolygon(), [chainFinishPolygon]);
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => chainOnCanvasClick(point),
    [chainOnCanvasClick],
  );

  // ── ADR-404 Phase 5c — publish handle στο ribbon bridge store ─────────────
  // Single writer (mirror wallToolBridgeStore). Ο bridge διαβάζει μέσω
  // `slabToolBridgeStore.get()` όταν δεν υπάρχει επιλεγμένη πλάκα, ώστε το panel
  // «Κλίση» να οδηγεί τα overrides σε drawing mode (η επόμενη πλάκα born-sloped).
  useEffect(() => {
    slabToolBridgeStore.set({
      isActive: phase !== 'idle',
      overrides,
      setParamOverrides,
    });
    return () => {
      // Καθάρισε μόνο αν είμαστε ο τρέχων publisher (μην σβήσεις νεότερο mount).
      if (slabToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
        slabToolBridgeStore.set(null);
      }
    };
  }, [phase, overrides, setParamOverrides]);

  // ── status text (i18n keys) ──────────────────────────────────────────────
  const getStatusText = useCallback((): string => {
    switch (phase) {
      case 'awaitingFirstVertex':
        return 'tools.slab.statusFirstVertex';
      case 'awaitingNextVertex':
        return 'tools.slab.statusNextVertex';
      default:
        return '';
    }
  }, [phase]);

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
    isActive: phase !== 'idle',
    isAwaitingFirstVertex: phase === 'awaitingFirstVertex',
    isAwaitingNextVertex: phase === 'awaitingNextVertex',
  };
}
