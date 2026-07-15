/**
 * sketch-fidelity-store — SSoT for the «Μολύβι» freehand fidelity level (ADR-658 M2, D3).
 *
 * Mirrors the Figma/Illustrator pencil «fidelity» control: how aggressively the raw
 * pointer trace is Ramer–Douglas–Peucker-simplified. The level maps to an RDP tolerance
 * in SCREEN pixels (zoom-independent) which `useSketchFreehandCommit` converts to world
 * units at commit time. Single micro-leaf store (ADR-040), persisted cross-session.
 *
 * Pattern: `systems/tools/xline-mode-store.ts`.
 */
import { createExternalStore } from '../../stores/createExternalStore';
import { storageGetString, storageSetString } from '../../utils/storage-utils';

export type SketchFidelityLevel = 'accurate' | 'balanced' | 'smooth' | 'verysmooth';

/** RDP tolerance (screen px) per level — larger = fewer points = smoother. */
export const SKETCH_FIDELITY_PX: Readonly<Record<SketchFidelityLevel, number>> = {
  accurate: 0.5,
  balanced: 2,
  smooth: 5,
  verysmooth: 10,
};

export const SKETCH_FIDELITY_LEVELS: readonly SketchFidelityLevel[] = [
  'accurate',
  'balanced',
  'smooth',
  'verysmooth',
];

export interface SketchFidelityState {
  readonly level: SketchFidelityLevel;
}

const STORAGE_KEY = 'dxf:sketchFidelity.lastUsed';

function isLevel(v: string | null): v is SketchFidelityLevel {
  return v === 'accurate' || v === 'balanced' || v === 'smooth' || v === 'verysmooth';
}

function loadPersistedLevel(): SketchFidelityLevel {
  const raw = storageGetString(STORAGE_KEY);
  return isLevel(raw) ? raw : 'balanced';
}

const store = createExternalStore<SketchFidelityState>({ level: loadPersistedLevel() });

/** Full snapshot (for useSyncExternalStore). */
export function getSketchFidelityState(): SketchFidelityState {
  return store.get();
}

/** RDP tolerance (screen px) for the current level — read at commit time. */
export function getSketchFidelityPx(): number {
  return SKETCH_FIDELITY_PX[store.get().level];
}

/** Set the fidelity level + persist. */
export function setSketchFidelityLevel(level: SketchFidelityLevel): void {
  if (store.get().level === level) return;
  store.set({ level });
  storageSetString(STORAGE_KEY, level);
}

/** Subscribe to changes (useSyncExternalStore compatible). */
export function subscribeSketchFidelity(cb: () => void): () => void {
  return store.subscribe(cb);
}
