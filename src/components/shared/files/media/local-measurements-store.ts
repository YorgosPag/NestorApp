/**
 * ENTERPRISE: local-measurements-store — ephemeral scratch store for the
 * transient measure tool's ACCUMULATED measurements.
 *
 * Big-players parallel: a personal scratch/markup layer (Bluebeam local
 * markups, Figma scratch) — visible ONLY to the current viewer, kept in-memory
 * for the session, NEVER written to Firestore or the floorplan-overlay
 * mutation gateway. A full page reload wipes it (matches Revit's measure tool).
 *
 * Scoped by floorplan key so measurements from drawing A never bleed onto the
 * coordinate space of drawing B when the gallery switches files.
 *
 * Framework-agnostic observable (subscribe / getSnapshot) so it binds cleanly
 * to React via `useSyncExternalStore` (see `useLocalMeasurements`). Snapshot
 * references are STABLE while unchanged — required to avoid render loops.
 *
 * @module components/shared/files/media/local-measurements-store
 * @enterprise ADR-340 §3.6 / Phase 9 STEP J
 */

import { createExternalStore } from '@/lib/state/createExternalStore';
import type { Point2D } from '@/components/shared/files/media/overlay-renderer';
import type { MeasureMode } from '@/components/shared/files/media/MeasureToolbar';

/** One committed (accumulated) measurement — geometry + pre-computed label value. */
export interface LocalMeasurement {
  /** Local-only id (NOT an enterprise/Firestore id — this never leaves memory). */
  id: string;
  points: Point2D[];
  mode: MeasureMode;
  value: number;
  unit: string;
}

interface ScopeState {
  measurements: LocalMeasurement[];
  /** Bumped on every clear — lets the overlay reset its in-progress geometry. */
  clearToken: number;
}

const DEFAULT_KEY = '__floorplan_default__';
const EMPTY: ReadonlyArray<LocalMeasurement> = Object.freeze([]);

const scopes = new Map<string, ScopeState>();
let idCounter = 0;

/**
 * Version-signal store (SSoT `createExternalStore`) — the `scopes` Map stays a
 * mutation accelerator; every mutation bumps this monotonic counter so React
 * (via `useSyncExternalStore`) re-reads the stable snapshot getters below.
 */
const signal = createExternalStore<number>(0);

function normalizeKey(key: string | null | undefined): string {
  return key && key.length > 0 ? key : DEFAULT_KEY;
}

function emit(): void {
  signal.set(signal.get() + 1);
}

/** Subscribe to any change in any scope. Returns an unsubscribe fn. */
export function subscribeLocalMeasurements(listener: () => void): () => void {
  return signal.subscribe(listener);
}

/** Stable snapshot of a scope's measurements (same reference while unchanged). */
export function getLocalMeasurements(key: string | null | undefined): ReadonlyArray<LocalMeasurement> {
  return scopes.get(normalizeKey(key))?.measurements ?? EMPTY;
}

/** Monotonic clear counter for a scope (0 when never cleared). */
export function getClearToken(key: string | null | undefined): number {
  return scopes.get(normalizeKey(key))?.clearToken ?? 0;
}

/** Append one measurement to a scope (immutable update → new array reference). */
export function commitLocalMeasurement(
  key: string | null | undefined,
  input: Omit<LocalMeasurement, 'id'>,
): void {
  const k = normalizeKey(key);
  const prev = scopes.get(k);
  const next: LocalMeasurement = {
    ...input,
    id: `lm_${++idCounter}`,
    points: [...input.points],
  };
  scopes.set(k, {
    measurements: [...(prev?.measurements ?? EMPTY), next],
    clearToken: prev?.clearToken ?? 0,
  });
  emit();
}

/** Wipe every measurement in a scope and bump its clear token. */
export function clearLocalMeasurements(key: string | null | undefined): void {
  const k = normalizeKey(key);
  const prev = scopes.get(k);
  scopes.set(k, {
    measurements: EMPTY as LocalMeasurement[],
    clearToken: (prev?.clearToken ?? 0) + 1,
  });
  emit();
}

/** Test-only reset of all scopes + listeners (never used in production paths). */
export function __resetLocalMeasurementsForTest(): void {
  scopes.clear();
  signal.reset(0); // drops every subscriber + resets the signal (no notify)
  idCounter = 0;
}
