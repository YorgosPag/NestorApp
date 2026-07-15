/**
 * sketch-output-store — SSoT for the «Μολύβι» freehand output type (ADR-658 M3, D1/D2).
 *
 * Mirrors AutoCAD's `SKPOLY` variable: the same sampled + RDP-simplified pointer trace is
 * emitted either as a straight-edge `PolylineEntity` («Τεθλασμένη») or as a smooth
 * `SplineEntity` («Καμπύλη»). The choice is read at commit/build time by
 * `drawing-entity-builders` (mirror of the `xline-mode-store` build-time read). Single
 * micro-leaf store (ADR-040), persisted cross-session.
 *
 * Pattern: sibling of `sketch-fidelity-store.ts` (one store = one setting, SRP).
 */
import { createExternalStore } from '../../stores/createExternalStore';
import { storageGetString, storageSetString } from '../../utils/storage-utils';

/** «Τεθλασμένη» (polyline) | «Καμπύλη» (spline) — the two SKPOLY-style outputs. */
export type SketchOutputType = 'polyline' | 'spline';

export const SKETCH_OUTPUT_TYPES: readonly SketchOutputType[] = ['polyline', 'spline'];

export interface SketchOutputState {
  readonly outputType: SketchOutputType;
}

const STORAGE_KEY = 'dxf:sketchOutput.lastUsed';

function isOutputType(v: string | null): v is SketchOutputType {
  return v === 'polyline' || v === 'spline';
}

function loadPersistedType(): SketchOutputType {
  const raw = storageGetString(STORAGE_KEY);
  return isOutputType(raw) ? raw : 'polyline';
}

const store = createExternalStore<SketchOutputState>({ outputType: loadPersistedType() });

/** Full snapshot (for useSyncExternalStore). */
export function getSketchOutputState(): SketchOutputState {
  return store.get();
}

/** Current output type — read at build time by `createEntityFromTool('sketch', …)`. */
export function getSketchOutputType(): SketchOutputType {
  return store.get().outputType;
}

/** Set the output type + persist. */
export function setSketchOutputType(outputType: SketchOutputType): void {
  if (store.get().outputType === outputType) return;
  store.set({ outputType });
  storageSetString(STORAGE_KEY, outputType);
}

/** Subscribe to changes (useSyncExternalStore compatible). */
export function subscribeSketchOutput(cb: () => void): () => void {
  return store.subscribe(cb);
}
