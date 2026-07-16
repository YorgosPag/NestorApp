/**
 * createEdgeToolStore — SSoT factory για τα «edge-driven modify tool» stores
 * (ADR-350 TRIM / ADR-353 EXTEND). Zero-React state, module-level pub/sub.
 *
 * TRIM και EXTEND είναι γεωμετρικά αντίστροφα αλλά **λειτουργικά ταυτόσημα**: ίδιο state
 * machine (idle → selectingEdges → picking ↔ fence/crossing), ίδιο quick/standard mode,
 * ίδιο EDGEMODE/PROJECTMODE, ίδιο fence-drag preview, ίδιο warning aggregation, ίδιο
 * closure-registry pattern. Διέφεραν ΜΟΝΟ σε: (1) το shape του preview, (2) το shape του
 * warning aggregator, (3) το όνομα του edge-ids πεδίου (`cuttingEdgeIds` vs
 * `boundaryEdgeIds` — εδώ ενοποιημένο σε `edgeIds`, όπως ήδη έκαναν και τα δύο hooks όταν
 * το προωθούσαν downstream ως `selectedEdgeIds`), (4) τα tool-specific extras (TRIM:
 * `eraseArmed`).
 *
 * Big-player layering (ίδιο δόγμα με createToolBridgeStore): η pub/sub μηχανή ΔΕΝ
 * ξαναγράφεται εδώ — delegate στο vanilla `createExternalStore` primitive. Αυτό το factory
 * προσθέτει ΜΟΝΟ τα edge-tool concerns από πάνω.
 *
 * Tool-specific state: πέρασέ το ως `TExtra` + `extraInitial`· γράψ' το με το `patch()`.
 *
 * @see stores/createExternalStore.ts — το vanilla pub/sub SSoT στο οποίο delegate-άρει
 * @see stores/createToolBridgeStore.ts — sibling domain factory (ίδιο pattern)
 * @see systems/trim/TrimToolStore.ts — ο TRIM consumer (+ eraseArmed extra)
 * @see systems/extend/ExtendToolStore.ts — ο EXTEND consumer
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §State Machine
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md §State Machine
 */

import type { Point2D } from '../rendering/types/Types';
import { pointsEqual } from '../rendering/entities/shared/geometry-vector-utils';
import { createExternalStore } from './createExternalStore';

// ── Shared vocabulary ─────────────────────────────────────────────────────────
// Τα 4 enums ήταν byte-identical σε trim-types.ts / extend-types.ts. Ένας ορισμός.

export type EdgeToolPhase = 'idle' | 'selectingEdges' | 'picking' | 'fence' | 'crossing';
export type EdgeToolMode = 'quick' | 'standard';
export type EdgeToolEdgeMode = 'noExtend' | 'extend';
export type EdgeToolProjectMode = 'none' | 'ucs' | 'view';

/** Warning aggregators είναι πάντα counters — μετρητές ανά αιτία, flushed σε ένα toast. */
export type EdgeToolWarnings = Readonly<Record<string, number>>;

/** Το state που ΚΑΘΕ edge tool μοιράζεται. Τα extras έρχονται ως intersection (`TExtra`). */
export interface EdgeToolBaseState<TPreview, TMulti, TWarnings extends EdgeToolWarnings> {
  readonly phase: EdgeToolPhase;
  readonly mode: EdgeToolMode;
  readonly edgeMode: EdgeToolEdgeMode;
  readonly projectMode: EdgeToolProjectMode;
  /** Empty array σε Quick mode = «όλες οι ορατές οντότητες». Populated σε Standard mode. */
  readonly edgeIds: ReadonlyArray<string>;
  /** Cursor world position, όπως το έδωσε τελευταία το mouse-move pipeline. */
  readonly hoverPoint: Point2D | null;
  /** Single-pick hover preview κάτω από το pickbox. */
  readonly hoverPreview: TPreview | null;
  /** Multi-pick preview (fence/crossing drag). */
  readonly dragPreview: TMulti | null;
  /** SHIFT κρατημένο → preview γίνεται το αντίστροφο tool (ADR-350 Q9 / ADR-353 Q4). */
  readonly inverseMode: boolean;
  /** Counters flushed σε ένα toast στο reset (ADR-350 G9 / ADR-353 G11). */
  readonly warnings: TWarnings;
  /** Fence/crossing drag start point (mousedown όταν αρχίζει το drag). */
  readonly dragStart: Point2D | null;
  /** Fence/crossing drag current point (60fps mousemove). */
  readonly dragCurrent: Point2D | null;
}

// ── Closure registries ────────────────────────────────────────────────────────
// Αποφεύγουν prop-threading μέσα από τους orchestrators: το tool hook δημοσιεύει τα
// closures στο activate, τα καθαρίζει στο deactivate (reset).

type PickFn = (worldPoint: Point2D, shiftKey: boolean) => void;
type FenceFn = (fenceStart: Point2D, fenceEnd: Point2D, shiftKey: boolean) => void;
type FencePreviewFn = (fenceStart: Point2D, fenceEnd: Point2D) => void;
type HoverMoveFn = (worldPoint: Point2D, shiftKey: boolean) => void;

export interface EdgeToolStore<TState, TPreview, TMulti, TWarnings extends EdgeToolWarnings> {
  getState(): TState;
  subscribe(listener: () => void): () => void;

  /** Escape hatch για tool-specific extras (π.χ. TRIM `eraseArmed`). */
  patch(partial: Partial<TState>): void;

  setPhase(phase: EdgeToolPhase): void;
  setMode(mode: EdgeToolMode): void;
  toggleMode(): void;
  setEdgeMode(edgeMode: EdgeToolEdgeMode): void;
  toggleEdgeMode(): void;
  setProjectMode(projectMode: EdgeToolProjectMode): void;
  setEdgeIds(ids: ReadonlyArray<string>): void;
  setHoverPoint(pt: Point2D | null): void;
  setHoverPreview(preview: TPreview | null): void;
  setDragPreview(preview: TMulti | null): void;
  setInverseMode(inverse: boolean): void;
  setDrag(start: Point2D | null, current: Point2D | null): void;

  incrementWarning(key: keyof TWarnings, by?: number): void;
  clearWarnings(): void;

  registerPickFn(fn: PickFn | null): void;
  execPick(worldPoint: Point2D, shiftKey: boolean): void;
  registerFenceFn(fn: FenceFn | null): void;
  execFence(fenceStart: Point2D, fenceEnd: Point2D, shiftKey: boolean): void;
  registerFencePreviewFn(fn: FencePreviewFn | null): void;
  execFencePreview(fenceStart: Point2D, fenceEnd: Point2D): void;
  registerHoverMoveFn(fn: HoverMoveFn | null): void;
  execHoverMove(worldPoint: Point2D, shiftKey: boolean): void;

  /** Καθαρίζει ΚΑΙ τα registries ΚΑΙ το state — καλείται στο tool deactivate. */
  reset(): void;
}

export function createEdgeToolStore<
  TPreview,
  TMulti,
  TWarnings extends EdgeToolWarnings,
  TExtra extends object = Record<never, never>,
>(config: {
  /** Zero aggregator — το state ξεκινά και επιστρέφει εδώ στο clearWarnings/reset. */
  readonly emptyWarnings: TWarnings;
  /** Initial τιμές των tool-specific extras. `{}` όταν το tool δεν έχει extras. */
  readonly extraInitial: TExtra;
}): EdgeToolStore<
  EdgeToolBaseState<TPreview, TMulti, TWarnings> & TExtra,
  TPreview,
  TMulti,
  TWarnings
> {
  type TState = EdgeToolBaseState<TPreview, TMulti, TWarnings> & TExtra;

  const INITIAL = {
    phase: 'idle',
    mode: 'quick',
    edgeMode: 'noExtend',
    projectMode: 'ucs',
    edgeIds: [],
    hoverPoint: null,
    hoverPreview: null,
    dragPreview: null,
    inverseMode: false,
    warnings: config.emptyWarnings,
    dragStart: null,
    dragCurrent: null,
    ...config.extraInitial,
  } as TState;

  const store = createExternalStore<TState>(INITIAL, { equals: Object.is });

  let pickFn: PickFn | null = null;
  let fenceFn: FenceFn | null = null;
  let fencePreviewFn: FencePreviewFn | null = null;
  let hoverMoveFn: HoverMoveFn | null = null;

  // Generic spread δεν στενεύει μόνο του σε TState — ο cast είναι sound εδώ (base ⊕ partial).
  const patch = (partial: Partial<TState>): void => {
    store.set({ ...store.get(), ...partial } as TState);
  };

  return {
    getState: store.get,
    subscribe: store.subscribe,
    patch,

    setPhase(phase) {
      patch({ phase } as Partial<TState>);
    },
    setMode(mode) {
      patch({ mode } as Partial<TState>);
    },
    toggleMode() {
      patch({ mode: store.get().mode === 'quick' ? 'standard' : 'quick' } as Partial<TState>);
    },
    setEdgeMode(edgeMode) {
      patch({ edgeMode } as Partial<TState>);
    },
    toggleEdgeMode() {
      patch({
        edgeMode: store.get().edgeMode === 'noExtend' ? 'extend' : 'noExtend',
      } as Partial<TState>);
    },
    setProjectMode(projectMode) {
      patch({ projectMode } as Partial<TState>);
    },
    setEdgeIds(ids) {
      patch({ edgeIds: ids } as Partial<TState>);
    },
    setHoverPoint(pt) {
      if (pointsEqual(store.get().hoverPoint, pt)) return;
      patch({ hoverPoint: pt } as Partial<TState>);
    },
    setHoverPreview(preview) {
      patch({ hoverPreview: preview } as Partial<TState>);
    },
    setDragPreview(preview) {
      patch({ dragPreview: preview } as Partial<TState>);
    },
    setInverseMode(inverse) {
      if (store.get().inverseMode === inverse) return;
      patch({ inverseMode: inverse } as Partial<TState>);
    },
    setDrag(start, current) {
      patch({ dragStart: start, dragCurrent: current } as Partial<TState>);
    },

    incrementWarning(key, by = 1) {
      const { warnings } = store.get();
      // Computed-key spread δεν διατηρεί το generic — cast αντί για `any`.
      const next = { ...warnings, [key]: warnings[key] + by } as TWarnings;
      patch({ warnings: next } as Partial<TState>);
    },
    clearWarnings() {
      patch({ warnings: config.emptyWarnings } as Partial<TState>);
    },

    registerPickFn(fn) {
      pickFn = fn;
    },
    execPick(worldPoint, shiftKey) {
      pickFn?.(worldPoint, shiftKey);
    },
    registerFenceFn(fn) {
      fenceFn = fn;
    },
    execFence(fenceStart, fenceEnd, shiftKey) {
      fenceFn?.(fenceStart, fenceEnd, shiftKey);
    },
    registerFencePreviewFn(fn) {
      fencePreviewFn = fn;
    },
    execFencePreview(fenceStart, fenceEnd) {
      fencePreviewFn?.(fenceStart, fenceEnd);
    },
    registerHoverMoveFn(fn) {
      hoverMoveFn = fn;
    },
    execHoverMove(worldPoint, shiftKey) {
      hoverMoveFn?.(worldPoint, shiftKey);
    },

    reset() {
      pickFn = null;
      fenceFn = null;
      fencePreviewFn = null;
      hoverMoveFn = null;
      store.set(INITIAL);
    },
  };
}
