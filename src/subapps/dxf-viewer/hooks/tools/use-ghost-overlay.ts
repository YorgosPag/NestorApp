/**
 * USE GHOST OVERLAY — Cluster #16 SSoT (ADR-625)
 *
 * Thin harness-consumption layer shared by every store-driven ghost overlay
 * (edit-fence / corner / transform previews). Owns the idiom that every ADR-398 §4
 * overlay hook repeats verbatim:
 *   - subscribe to the tool store's `phase` (low-freq activation trigger)
 *   - resolve `isActive` from that phase
 *   - build the canonical `toScreen` closure from the frame's transform + viewport
 *   - hand `(frame, state, toScreen)` to the caller's stable draw callback
 *
 * Sits between {@link useCanvasGhostPreview} (RAF/clear/viewport harness) and the
 * per-family paint primitives, so those primitives carry ONLY their paint logic.
 *
 * @module hooks/tools/use-ghost-overlay
 * @see hooks/tools/useCanvasGhostPreview — RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

/** Minimal store surface: the two members every overlay subscribes to / reads. */
export interface GhostOverlayStore<S> {
  subscribe(listener: () => void): () => void;
  getState(): S;
}

export interface GhostOverlayConfig<S extends { phase: string }> {
  readonly store: GhostOverlayStore<S>;
  /** Reactive activation gate resolved from the subscribed phase. */
  readonly isActive: (phase: S['phase']) => boolean;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
  /**
   * Stable (useCallback-wrapped) paint callback. Receives the live frame, a fresh
   * store snapshot, and the canonical world→screen projector for this frame.
   */
  readonly draw: (frame: GhostDrawFrame, state: S, toScreen: (p: Point2D) => Point2D) => void;
}

export function useGhostOverlay<S extends { phase: string }>(config: GhostOverlayConfig<S>): void {
  const { store, isActive, transform, getCanvas, getViewportElement, draw } = config;

  const phase = useSyncExternalStore(store.subscribe, () => store.getState().phase);

  const wrapped = useCallback(
    (frame: GhostDrawFrame) => {
      const s = store.getState();
      const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, frame.transform, frame.viewport);
      draw(frame, s, toScreen);
    },
    [store, draw],
  );

  useCanvasGhostPreview({
    isActive: isActive(phase),
    getCanvas,
    getViewportElement,
    transform,
    draw: wrapped,
  });
}
