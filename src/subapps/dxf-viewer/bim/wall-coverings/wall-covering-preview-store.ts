/**
 * ADR-511 — Wall-covering tool live-preview store.
 *
 * Σε αντίθεση με τα polygon tools (slab/floor-finish) που κρατούν λίστα κορυφών, εδώ το
 * preview είναι **λωρίδα στην παρειά ενός κλειδωμένου τοίχου**. Μετά το 1ο κλικ (pick τοίχου
 * + παρειάς + spanStart) ο tool γράφει εδώ το **draw context** (locked host + faceSide +
 * spanStart + assembly). Ο `drawing-preview-generator` (που έχει τον cursor) προβάλλει τον
 * cursor στον άξονα → spanEnd → υπολογίζει το live strip. Έτσι το per-frame preview ζει στον
 * generator (όπως slab/wall), χωρίς ο tool να χειρίζεται move events.
 *
 * Single-writer (`useWallCoveringTool`), multi-reader (`drawing-preview-generator`). Zero
 * `useSyncExternalStore` σε high-frequency stores — ADR-040-safe.
 *
 * @see bim/floor-finishes/floor-finish-preview-store.ts — το πρότυπο
 * @see hooks/drawing/wall-covering-preview-helpers.ts — ο generator consumer
 */

import { useSyncExternalStore } from 'react';
import type { WallCoveringFaceSide, WallCoveringLayer } from '../types/wall-covering-types';
import type { WallCoveringHost } from './wall-covering-strip-geometry';
import type { SceneUnits } from '../../utils/scene-units';
import { createExternalStore } from '../../stores/createExternalStore';

/** Κλειδωμένο context σχεδίασης μετά το 1ο κλικ (pick τοίχου + παρειάς + spanStart). */
export interface WallCoveringDrawContext {
  readonly host: WallCoveringHost;
  readonly faceSide: WallCoveringFaceSide;
  readonly spanStartMm: number;
  readonly layers: readonly WallCoveringLayer[];
  readonly sceneUnits: SceneUnits;
}

export interface WallCoveringPreviewState {
  /** `null` πριν το 1ο κλικ (awaiting wall). Set μετά το pick (awaiting spanEnd). */
  readonly context: WallCoveringDrawContext | null;
}

const EMPTY: WallCoveringPreviewState = Object.freeze({ context: null });

const store = createExternalStore<WallCoveringPreviewState>(EMPTY);

export const wallCoveringPreviewStore = {
  /** Writer — called by `useWallCoveringTool` μετά το pick (lock) ή reset. */
  set(context: WallCoveringDrawContext | null): void {
    if (store.get().context === context) return;
    const nextState: WallCoveringPreviewState = context ? { context } : EMPTY;
    store.set(nextState);
  },
  /** Reset σε empty (tool deactivated / committed / idle). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },
  /** Non-React reader — για τον `drawing-preview-generator` consumer. */
  get(): WallCoveringPreviewState {
    return store.get();
  },
};

/** React subscription. Returns the latest wall-covering-preview state. */
export function useWallCoveringPreview(): WallCoveringPreviewState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
