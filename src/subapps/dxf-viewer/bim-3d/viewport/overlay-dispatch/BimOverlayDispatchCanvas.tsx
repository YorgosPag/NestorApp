'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-551 + ADR-555 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-555-unified-3d-projected-overlay-dispatch-canvas.md
 *
 * BimOverlayDispatchCanvas — the ONE shared dispatch canvas for the 3D viewport's camera-projected
 * Canvas2D overlays (ADR-555), the 3D sibling of the 2D `PreviewCanvas` dispatch (ADR-552/554). It
 * replaces the former 5 separate overlay leaves (grip, DXF hover-glow, wall-HUD, tracking, placement),
 * each of which carried its OWN `<canvas>` + container + RAF loop + camera-motion gate (+ occluder in
 * two) — the waste the ADR-551 census flagged (§5.2 #4/#5 + §5.3 «ισχυρότερο εύρημα»).
 *
 * ONE `<canvas pointer-events-none>`, ONE `useRafWhile`, ONE `useCameraMotionGate`, ONE
 * `useGripDepthOccluder` (shared by the grip + placement passes — they never coexist, and the occluder
 * is stateless per-call anyway). Each layer is a `BimOverlayPass` from its own `use*Pass()` hook; the
 * shared `paintBimOverlayFrame` sizes+clears once and paints them in z-order (bottom→top):
 * hover-glow → grips → tracking → wall-HUD → placement.
 *
 * Coexistence (ADR-555 §audit): the passes are NOT mutually exclusive — a hovered entity B lights up
 * while A is selected (hover-glow + grips), and the wall-HUD shows on top of the ambient tracking lines
 * (tracking + wall-HUD). Hence z-ordered multi-pass, not a one-at-a-time switch.
 *
 * ADR-040 micro-leaf: every pass subscribes ONLY to its low-frequency activation gate; high-frequency
 * payloads are read imperatively inside each pass's `paint`. No high-frequency React state here.
 */

import { useRef, useMemo, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { useRafWhile, useCameraMotionGate, useGripDepthOccluder } from '../overlay-raf';
import { paintBimOverlayFrame, activePassSignature, type BimOverlayPass } from './bim-overlay-pass';
import { useHoverGlowPass } from './use-hover-glow-pass';
import { useGripPass } from './use-grip-pass';
import { useTrackingPass } from './use-tracking-pass';
import { useWallHudPass } from './use-wall-hud-pass';
import { usePlacementPass } from './use-placement-pass';

export interface BimOverlayDispatchCanvasProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function BimOverlayDispatchCanvas({ managerRef }: BimOverlayDispatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ONE occluder + ONE motion gate, shared by every pass (ADR-544 dedup → ADR-555 single instance).
  const occluderRef = useGripDepthOccluder();
  const isCameraMoving = useCameraMotionGate();

  // z-order bottom→top: hover-glow → grips → tracking → wall-HUD → placement.
  const hover = useHoverGlowPass(containerRef);
  const grip = useGripPass();
  const tracking = useTrackingPass();
  const wallHud = useWallHudPass();
  const placement = usePlacementPass();
  const passes = useMemo<readonly BimOverlayPass[]>(
    () => [hover, grip, tracking, wallHud, placement],
    [hover, grip, tracking, wallHud, placement],
  );

  // Read the latest passes inside the stable RAF draw without re-subscribing the loop each render.
  const passesRef = useRef(passes);
  passesRef.current = passes;
  const active = passes.some((p) => p.active);

  // Signature of the last *painted* active set → `forcePaint` clears a layer that just turned off.
  const lastSigRef = useRef('');
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const cur = passesRef.current;
    const sig = activePassSignature(cur);
    const painted = paintBimOverlayFrame(
      canvas, container, manager, cur, occluderRef.current, isCameraMoving, sig !== lastSigRef.current,
    );
    if (painted) lastSigRef.current = sig;
  }, [managerRef, isCameraMoving, occluderRef]);

  // Clear the canvas when every layer is off / on unmount (shared overlay RAF SSoT, ADR-542).
  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastSigRef.current = '';
  }, []);
  useRafWhile(active, draw, onStop, 'bim-overlay-dispatch'); // 🔬 ADR-549 Phase 0

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
