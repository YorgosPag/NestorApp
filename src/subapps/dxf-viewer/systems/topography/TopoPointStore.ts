/**
 * TopoPointStore — vanilla SSoT for the RAW survey inputs of the topography subsystem
 * (ADR-650 Milestone 1). Holds the survey points (X,Y,Z canonical mm) and the breakline
 * constraints. The TIN surface and the contours are DERIVED from this — never stored here
 * (big-player pattern: raw survey is the one source of truth, surface/contours are products).
 *
 * Pattern: `createExternalStore` (ADR-040 micro-leaf / vanilla store), mirroring
 * `systems/tools/xline-mode-store.ts`. Zero React state; consumed via `useSyncExternalStore`.
 * No persistence in Milestone 1 (points arrive per session from a file/in-memory load).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { TopoPoint, Breakline } from './topo-types';

// ─── State ─────────────────────────────────────────────────────────────────────

export interface TopoPointState {
  readonly points: readonly TopoPoint[];
  readonly breaklines: readonly Breakline[];
}

const EMPTY_STATE: TopoPointState = { points: [], breaklines: [] };

const store = createExternalStore<TopoPointState>(EMPTY_STATE);

// ─── Reads ─────────────────────────────────────────────────────────────────────

/** Full snapshot (safe as `useSyncExternalStore` getSnapshot). */
export function getTopoState(): TopoPointState {
  return store.get();
}

/** Current survey points. */
export function getTopoPoints(): readonly TopoPoint[] {
  return store.get().points;
}

/** Current breakline constraints. */
export function getTopoBreaklines(): readonly Breakline[] {
  return store.get().breaklines;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/** Replace ALL points (e.g. a fresh file load). Breaklines are preserved. */
export function setTopoPoints(points: readonly TopoPoint[]): void {
  store.set({ ...store.get(), points: [...points] });
}

/** Append points to the existing set. */
export function addTopoPoints(points: readonly TopoPoint[]): void {
  const current = store.get();
  store.set({ ...current, points: [...current.points, ...points] });
}

/** Replace ALL breaklines. Points are preserved. */
export function setTopoBreaklines(breaklines: readonly Breakline[]): void {
  store.set({ ...store.get(), breaklines: [...breaklines] });
}

/**
 * Add one breakline from an ordered vertex list, minting an enterprise id (ADR-017/N.6).
 * Returns the new breakline id. Vertices with fewer than 2 points are rejected (no id).
 */
export function addBreakline(vertices: readonly TopoPoint[], closed = false): string | null {
  if (vertices.length < 2) return null;
  const id = generateEntityId();
  const breakline: Breakline = { id, vertices: [...vertices], closed };
  const current = store.get();
  store.set({ ...current, breaklines: [...current.breaklines, breakline] });
  return id;
}

/** Clear points AND breaklines back to empty. */
export function clearTopo(): void {
  store.set(EMPTY_STATE);
}

// ─── Subscription ────────────────────────────────────────────────────────────────

/** Subscribe to state changes; returns unsubscribe (useSyncExternalStore-compatible). */
export function subscribeTopo(listener: () => void): () => void {
  return store.subscribe(listener);
}
