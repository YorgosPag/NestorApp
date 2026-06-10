/**
 * immediate-transform-frame — SSoT for "repaint a 2D overlay in sync with the panning canvas".
 *
 * The DXF canvas pans/zooms via the 60 fps IMMEDIATE transform (not React state). Any 2D overlay
 * that draws in world coordinates must reproject through that SAME immediate transform, in the
 * SAME `UnifiedFrameScheduler` frame, or it visibly lags the canvas. This module centralises that
 * one pattern (previously copy-pasted): register a LOW-priority scheduler subsystem whose
 * dirty-check fires only when the immediate transform actually changed.
 *
 * Used by: the clash markers (`canvas-layer-stack-clash-overlay`), the MEP auto-design proposal
 * ghost (`ProposalGhostOverlay`) and the home-run circuit wires (`HomeRunWiresOverlay`). The 3D
 * camera-projected overlays use the analogous camera-signature gate (a different signal source),
 * so they stay separate by design.
 *
 * @see ./UnifiedFrameScheduler.ts — the RAF orchestrator the subsystem registers with
 * @see ../../systems/cursor/ImmediateTransformStore.ts — the zero-lag transform SSoT
 */

import { UnifiedFrameScheduler, RENDER_PRIORITIES } from './UnifiedFrameScheduler';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

/** Stable signature of the immediate 2D transform — changes iff pan/zoom changed. */
export function immediateTransformSignature(): string {
  const t = getImmediateTransform();
  return `${t.scale},${t.offsetX},${t.offsetY}`;
}

/**
 * Register a LOW-priority scheduler subsystem that invokes `onFrame` once immediately, then on
 * every frame where the immediate 2D transform changed (zero-lag pan/zoom). Returns the
 * unregister fn — call it on cleanup.
 *
 * @param id    Unique scheduler subsystem id (one per overlay instance).
 * @param name  Human label for scheduler debug/metrics.
 * @param onFrame  The overlay's repaint — reads `getImmediateTransform()` itself when drawing.
 */
export function subscribeImmediateTransformFrame(
  id: string,
  name: string,
  onFrame: () => void,
): () => void {
  let lastSig = '';
  const unregister = UnifiedFrameScheduler.register(
    id,
    name,
    RENDER_PRIORITIES.LOW,
    () => onFrame(),
    () => {
      const sig = immediateTransformSignature();
      if (sig === lastSig) return false;
      lastSig = sig;
      return true;
    },
  );
  onFrame(); // initial paint (and on every re-register)
  return unregister;
}
