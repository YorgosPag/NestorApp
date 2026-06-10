'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ProposalGhostOverlay — SSoT dedicated-canvas overlay for EVERY MEP auto-design proposal
 * ghost (water, drainage, heating, electrical, HVAC, fire, gas).
 *
 * WHY THIS EXISTS (the two bugs it fixes):
 *   1. PERSISTENCE — the seven proposal ghosts used to paint onto the SHARED transient
 *      `PreviewCanvas` (`getCanvas()`), which the `PreviewRenderer` wipes whenever it goes
 *      dirty (cursor / snap). The ghost vanished the moment the pointer stopped. This overlay
 *      owns its OWN `<canvas>` (mounted ONLY while a proposal is under review), so nothing else
 *      clears it.
 *   2. ZERO-LAG PAN/ZOOM — repainting on the React `transform` prop lags the canvas (which pans
 *      via the 60 fps IMMEDIATE transform, not React state). So the ghost reprojects
 *      **imperatively** in a LOW-priority `UnifiedFrameScheduler` frame — AFTER the 2D canvases
 *      render, reading `getImmediateTransform()` — gated on the transform actually changing. This
 *      is the exact zero-lag mechanism the clash 2D overlay uses (`canvas-layer-stack-clash-overlay`).
 *
 * ADR-040 micro-leaf: each discipline mount subscribes to its own low-frequency proposal store
 * and passes a discipline-agnostic `paint(ctx, transform, viewport)` closure; this component owns
 * the dedicated canvas + dpr/clear boilerplate + the scheduler reproject. The shell never
 * subscribes and the overlay never re-renders on transform (CHECK 6C safe).
 *
 * @see ./proposal-ghost-paint.ts — shared segment paint helper (6 pipe/duct/fuel disciplines)
 * @see ./canvas-layer-stack-clash-overlay.tsx — the zero-lag scheduler-reproject precedent
 * @see ../../systems/cursor/ImmediateTransformStore.ts — zero-lag transform SSoT
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';

/** Discipline-supplied paint: strokes the proposal onto the cleared, dpr-scaled context. */
export type ProposalGhostPaint = (
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
) => void;

export interface ProposalGhostOverlayProps {
  /** A proposal is under review → mount the canvas + paint. Idle ⇒ renders `null`. */
  readonly active: boolean;
  /**
   * The React (throttled) transform — accepted for API symmetry with the other canvas mounts,
   * but NOT used for painting: the reproject reads `getImmediateTransform()` so it is zero-lag.
   * Left undestructured (same precedent as `canvas-layer-stack-clash-overlay`).
   */
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly paint: ProposalGhostPaint;
  /** Stable id (per discipline) — `data-dxf-overlay` + the scheduler subsystem key. */
  readonly dataOverlay: string;
}

/** Current device-pixel ratio (1 on the server / when unavailable). */
function devicePixelRatioSafe(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

export const ProposalGhostOverlay = React.memo(function ProposalGhostOverlay({
  active,
  viewport,
  paint,
  dataOverlay,
}: ProposalGhostOverlayProps): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The scheduler subsystem is registered once per `active`; it reads the latest paint/viewport
  // through refs so a proposal/resize change is reflected without re-registering.
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Clear (dpr-scaled) + paint with the IMMEDIATE transform — read at draw time, never the prop.
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = devicePixelRatioSafe();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vp = viewportRef.current;
    if (vp.width <= 0 || vp.height <= 0) return;
    paintRef.current(ctx, getImmediateTransform(), vp);
  }, []);

  // Zero-lag pan/zoom: reproject in the LOW-priority scheduler frame (after the 2D canvases),
  // gated on the immediate transform changing — frame-synced with the canvas, no React churn.
  // SSoT: the same helper the clash + home-run-wires overlays use.
  useEffect(() => {
    if (!active) return;
    return subscribeImmediateTransformFrame(
      `proposal-ghost-${dataOverlay}`,
      `Proposal Ghost ${dataOverlay}`,
      repaint,
    );
  }, [active, dataOverlay, repaint]);

  // Repaint on proposal change / resize (transform unchanged ⇒ the scheduler would not fire).
  useEffect(() => {
    if (active) repaint();
  }, [active, paint, viewport, repaint]);

  if (!active) return null;

  // High-DPI: backing store = CSS px × dpr, drawn in CSS px via `setTransform(dpr)`. CSS
  // `w-full h-full` stretches the element to the (CSS-sized) viewport container.
  const dpr = devicePixelRatioSafe();
  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay={dataOverlay}
      width={Math.max(1, Math.round(viewport.width * dpr))}
      height={Math.max(1, Math.round(viewport.height * dpr))}
      className="pointer-events-none absolute inset-0 w-full h-full z-[14]"
      aria-hidden="true"
    />
  );
});
