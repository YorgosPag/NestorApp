/**
 * SelectionCyclingStore — ADR-357 Phase 15 (G13 Selection Cycling).
 * Zero-React singleton. Same pattern as HoverStore / CommandLineStore.
 *
 * State: active flag + candidate list + current highlight index + popover anchor.
 * Consumed by: use-selection-cycling.ts (keyboard) + SelectionCyclingPopover.tsx (render).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { HitTestResult } from '../../services/HitTestingService';
import type { Entity } from '../../types/entities';
import { buildCandidateSemantics, type CandidateSemantics } from './candidate-label';
// ADR-448 — active storey FFL (datum-relative absolute) so popover elevations match the 3D render
// datum. Zero-React zustand singleton, safe to read from any context; read ONCE per build (ADR-040).
import { useActiveStoreyStore } from '../levels/active-storey-store';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Resolves an entity id → the live `Entity`, or `undefined` when not found. */
export type EntityResolver = (id: string) => Entity | undefined;

export interface CyclingCandidate {
  readonly id: string;
  readonly entityType: string;
  readonly layer: string;
  /**
   * Semantic fields (slab role/thickness/elevation, …) resolved ONCE at build
   * time via the optional `resolveEntity` param below — never re-looked-up at
   * popover render time (ADR-040). `undefined` when `resolveEntity` was not
   * supplied or the entity carries no known semantics (generic fallback).
   * @see candidate-label.ts — buildCandidateSemantics / buildCandidateLabel
   */
  readonly semantics?: CandidateSemantics;
}

/**
 * ADR-659 — SSoT dedup: HitTestResult[] → deduped CyclingCandidate[] (first hit wins,
 * preserving the priority→distance sort of `hitTestAll`). Shared by the keyboard trigger
 * (`use-selection-cycling`) AND the repeated-click resolver — no dedup clone (N.18).
 *
 * `resolveEntity` — optional entity lookup (scene.entities.find by id) so the popover
 * can show a meaningful role/thickness/elevation label instead of the raw entity-type
 * + internal level id (bug fix, 2026-07-17). Omitted ⇒ candidates carry no `semantics`
 * (generic fallback label at render time).
 *
 * Storey FFL — read ONCE here (the single-floor 2D canvas hit-tests one active storey,
 * ADR-448) and passed into `buildCandidateSemantics` so slab/wall/column/beam elevations
 * render ABSOLUTE (building-datum), matching the 3D converters. `?? 0` = no active storey
 * (unlinked building / tests) → legacy floor-relative value.
 */
export function buildCandidatesFromHits(
  hits: readonly HitTestResult[],
  resolveEntity?: EntityResolver,
): CyclingCandidate[] {
  const seen = new Set<string>();
  const candidates: CyclingCandidate[] = [];
  const storeyFloorElevationMm = useActiveStoreyStore.getState().context?.floorElevationMm ?? 0;
  for (const hit of hits) {
    if (hit.entityId && !seen.has(hit.entityId)) {
      seen.add(hit.entityId);
      candidates.push({
        id: hit.entityId,
        entityType: hit.entityType ?? 'entity',
        layer: hit.layer ?? '0',
        semantics: buildCandidateSemantics(resolveEntity?.(hit.entityId), storeyFloorElevationMm),
      });
    }
  }
  return candidates;
}

export interface CyclingState {
  readonly active: boolean;
  readonly candidates: readonly CyclingCandidate[];
  readonly currentIndex: number;
  /** Page-level client X for popover anchor (from mousemove). */
  readonly clientX: number;
  /** Page-level client Y for popover anchor (from mousemove). */
  readonly clientY: number;
}

// ─── Internal state ───────────────────────────────────────────────────────────

const DEFAULT_STATE: CyclingState = {
  active: false,
  candidates: [],
  currentIndex: 0,
  clientX: 0,
  clientY: 0,
};

// Reducer-over-single-object on the SSoT primitive (`equals: Object.is` = identity
// guard· κάθε mutation παράγει νέο object → πραγματικές αλλαγές notify-άρουν πάντα).
const store = createExternalStore<CyclingState>(DEFAULT_STATE, { equals: Object.is });

// ─── ADR-659 armed repeated-click state (NON-reactive) ──────────────────────────
// The 1st click on a stack arms these WITHOUT notifying subscribers (no popover
// re-render on every plain click). The popover reacts only to `startCycling`.
let armedPoint: { x: number; y: number } | null = null;
let armedCandidates: readonly CyclingCandidate[] = [];
let armedIndex = 0;

function clearArmedState(): void {
  armedPoint = null;
  armedCandidates = [];
  armedIndex = 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const SelectionCyclingStore = {
  // ── React subscription (useSyncExternalStore-compatible) ──

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): CyclingState {
    return store.get();
  },

  // ── Mutations ──

  /**
   * Begin cycling at the given screen anchor with N≥2 candidates.
   * ADR-659 — `startIndex` lets the repeated-click resolver open the popover already
   * synced to the currently-cycled candidate (default 0 = keyboard Shift+Space trigger).
   */
  startCycling(candidates: readonly CyclingCandidate[], clientX: number, clientY: number, startIndex = 0): void {
    const currentIndex = candidates.length > 0
      ? ((startIndex % candidates.length) + candidates.length) % candidates.length
      : 0;
    store.set({ active: true, candidates: [...candidates], currentIndex, clientX, clientY });
  },

  /** Advance the highlighted candidate by one (wraps around). */
  cycleNext(): void {
    const state = store.get();
    if (!state.active || state.candidates.length === 0) return;
    const next = (state.currentIndex + 1) % state.candidates.length;
    store.set({ ...state, currentIndex: next });
  },

  /** Return the ID of the currently highlighted candidate, or null. */
  getCurrentId(): string | null {
    const state = store.get();
    if (!state.active || state.candidates.length === 0) return null;
    return state.candidates[state.currentIndex]?.id ?? null;
  },

  /** Dismiss cycling without selecting. */
  cancel(): void {
    if (!store.get().active) return;
    store.set(DEFAULT_STATE);
  },

  /** Lightweight synchronous check — avoids snapshot allocation in hot paths. */
  isActive(): boolean {
    return store.get().active;
  },

  // ── ADR-659 repeated-click arming (ArchiCAD Quick Selection) ──

  /**
   * Arm the stack under a 1st click so a 2nd click on the SAME screen point cycles.
   * Non-reactive: does NOT open the popover (fast path stays friction-free). Index resets
   * to 0 (the top-priority candidate the 1st click just selected).
   */
  armFromClick(candidates: readonly CyclingCandidate[], screenX: number, screenY: number): void {
    armedPoint = { x: screenX, y: screenY };
    armedCandidates = [...candidates];
    armedIndex = 0;
  },

  /** True when a screen point is within `thresholdPx` of the armed 1st-click point. */
  matchesArmedPoint(screenX: number, screenY: number, thresholdPx: number): boolean {
    if (!armedPoint || armedCandidates.length < 2) return false;
    const dx = screenX - armedPoint.x;
    const dy = screenY - armedPoint.y;
    return Math.hypot(dx, dy) <= thresholdPx;
  },

  /** Advance the armed cycle by one (wraps) and return the now-current candidate. */
  advanceArmed(): CyclingCandidate | null {
    if (armedCandidates.length === 0) return null;
    armedIndex = (armedIndex + 1) % armedCandidates.length;
    return armedCandidates[armedIndex] ?? null;
  },

  getArmedCandidates(): readonly CyclingCandidate[] {
    return armedCandidates;
  },

  getArmedIndex(): number {
    return armedIndex;
  },

  /** Drop the armed repeated-click state (new click point / additive select). */
  clearArmed(): void {
    clearArmedState();
  },
} as const;
