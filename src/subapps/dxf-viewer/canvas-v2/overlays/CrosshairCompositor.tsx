'use client';

/**
 * 🏢 ENTERPRISE CROSSHAIR COMPOSITOR — shared 2D/3D core (ADR-040 / ADR-545 / ADR-549)
 *
 * The CAD crosshair render code, ONE source of truth for BOTH the 2D canvas
 * (`CrosshairOverlay`) and the 3D BIM viewport (`BimCrosshairOverlay3D`).
 *
 * ADR-549 Phase 6 — LOW-LATENCY PRESENTATION. The crosshair is drawn into a
 * `desynchronized` Canvas2D context SYNCHRONOUSLY on every move (the Figma /
 * Onshape / Excalidraw low-latency path), REPLACING the old promoted DOM
 * `translate3d` layer. Browser-proven (Phase 5/6 bisection 2026-06-29): with
 * every scene/overlay/2D render killed, a DOM crosshair still «swims» behind the
 * pointer — pure compositor present latency of the promoted layer; a
 * desynchronized-canvas crosshair tracks tighter (A/B verified). DOM layers
 * cannot opt into `desynchronized` (canvas-only hint), hence the render-target
 * move. The geometry/badge/aperture/style logic is UNCHANGED (reused from
 * `crosshair-compositor-layout` + drawn by `crosshair-compositor-paint`).
 *
 * What it does NOT own — the per-host POSITION + SNAP drivers, which are the only
 * thing that differs between 2D and 3D:
 *   - 2D feeds the (already snapped) SCREEN position synchronously via
 *     `ImmediatePositionStore.registerDirectRender`, and snap-active via
 *     `ImmediateSnapStore`.
 *   - 3D feeds a camera-PROJECTED canvas-local position each move (the snap point
 *     reprojects as the camera orbits), and snap-active from `Snap3DOverlayStore`.
 *
 * Each host drives this core imperatively through the {@link CrosshairCompositorHandle}
 * ref — `applyTransform(pos)` per move, `setSnapActive(bool)` on snap-marker visibility.
 * The core keeps the last applied position so settings / suppression / resize changes
 * re-apply without the host re-feeding it (decoupled from any position store). ADR-040:
 * zero high-frequency React state; the canvas is driven imperatively through refs.
 *
 * @module CrosshairCompositor
 * @version 2.0.0 — desynchronized-canvas render target (2026-06-29, ADR-549 Phase 6)
 */

import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../../systems/cursor/config';
import { useGripContext } from '../../providers/GripProvider';
import { portalComponents } from '@/styles/design-tokens';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized ruler margins from Single Source of Truth
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
// ADR-513 — κρύψε το σταυρόνημα όταν ο κέρσορας μπαίνει στα πλήκτρα του «Δαχτυλιδιού Εντολών».
import { isCrosshairSuppressed, subscribeCrosshairSuppression } from '../../systems/cursor/CrosshairSuppressionStore';
import { getHoveredEntity, subscribeHoveredEntity, getHoveredOverlay, subscribeHoveredOverlay } from '../../systems/hover/HoverStore';
// ADR-538 — the "+"/"−" badge text+colours are a shared SSoT (reused by both viewports).
import { resolveHoverBadge } from '../../systems/hover/hover-add-badge';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { subscribeDevicePixelRatio } from '../../systems/cursor/device-pixel-ratio'; // ADR-549 Phase 7
import {
  computeArmLength,
  computeCenterGap,
  toAreaLocal,
  isWithinArea,
  type CrosshairLineStyle,
} from './crosshair-compositor-layout';
import { paintCrosshairFrame, computeCrosshairClearRects, type ClearRect } from './crosshair-compositor-paint';

/** Imperative driver surface exposed to each host (2D screen-store / 3D camera-move). */
export interface CrosshairCompositorHandle {
  /** Move the crosshair centre to `pos` (host-container-local px); null hides it. */
  applyTransform(pos: Point2D | null): void;
  /** ADR-515 — true while a snap marker is visible ⇒ hide the centre square. */
  setSnapActive(active: boolean): void;
}

export interface CrosshairCompositorProps {
  className?: string;
  isActive?: boolean;
  /** ✅ ENTERPRISE: Ruler margins so the crosshair is not drawn over the rulers (3D passes 0). */
  rulerMargins?: {
    left: number;
    top: number;
    bottom: number;
  };
  /** ✅ ADR-007: Style prop for CAD-grade layout (height excludes ruler). */
  style?: React.CSSProperties;
}

export const CrosshairCompositor = forwardRef<CrosshairCompositorHandle, CrosshairCompositorProps>(
  function CrosshairCompositor(
    { className = '', isActive = true, rulerMargins = COORDINATE_LAYOUT.MARGINS, style },
    ref,
  ) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ADR-549 Phase 6 — the desynchronized 2D context (created once) + the DPR baked into its
  // transform, so the per-move `draw` does ZERO layout reads / context allocation.
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const settingsRef = useRef<CursorSettings>(getCursorSettings());
  const hoveredEntityIdRef = useRef<string | null>(getHoveredEntity());
  const hoveredOverlayIdRef = useRef<string | null>(getHoveredOverlay());
  const shiftHeldRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(isActive);
  const marginsRef = useRef(rulerMargins);
  const areaSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // ADR-515 — true όταν φωτίζεται έλξη (snap marker ορατός) ⇒ κρύψε το κεντρικό τετράγωνο.
  const snapActiveRef = useRef<boolean>(false);
  // Last applied position (host-container-local px). Lets settings/suppression/resize
  // re-apply WITHOUT the host re-feeding it (decoupled from any position store).
  const lastPosRef = useRef<Point2D | null>(null);
  // ADR-549 Phase 6 — DIRTY-RECT: the thin bands the PREVIOUS frame painted, cleared
  // before the next paint instead of the whole backing store (the «trails» fix — a
  // full-screen cross's bbox is the whole canvas, so we clear bands, not a bbox).
  const lastClearRef = useRef<ClearRect[]>([]);

  // Keep event-time refs current (read inside the compositor callbacks).
  isActiveRef.current = isActive;
  marginsRef.current = rulerMargins;

  const { gripSettings } = useGripContext();
  const { showAperture, apertureSize } = gripSettings;

  // ============================================================================
  // PER-MOVE DRAW — the ONLY thing called on every move. Clears the canvas and
  // repaints the whole crosshair SYNCHRONOUSLY into the desynchronized context
  // (low-latency present). Reuses the geometry SSoT (arm/gap) + the pure paint.
  // Zero layout reads here (size/dpr are cached by `resize`).
  // ============================================================================
  const draw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // ADR-549 Phase 6 — DIRTY-RECT clear: wipe ONLY the bands the previous frame painted
    // (under the DPR transform, so CSS-px rects map to device pixels). A full-screen cross's
    // bbox is the whole canvas, so a bbox clear is no better than full-screen — band-clear
    // shrinks the fill ~100x, minimising the desynchronized single-buffer present window that
    // produced the periodic «trails». `clearRect` is clamped by the browser, so out-of-canvas
    // bands are a no-op; the area outside the drawable clip was never painted.
    const { w: areaW, h: areaH } = areaSizeRef.current;
    const m = marginsRef.current;
    const prevRects = lastClearRef.current;
    for (let i = 0; i < prevRects.length; i++) {
      const r = prevRects[i];
      ctx.clearRect(r.x, r.y, r.w, r.h);
    }
    lastClearRef.current = [];

    const cross = settingsRef.current.crosshair;
    const pos = lastPosRef.current;
    // ADR-513 — όταν ο κέρσορας είναι πάνω στα πλήκτρα του NavWheel, εξαφάνισε το σταυρόνημα.
    const active = isActiveRef.current && !!pos && (cross?.enabled ?? false) && !isCrosshairSuppressed();
    if (!cross || !active || !pos) return; // cleared ⇒ hidden

    const local = toAreaLocal(pos, m);
    if (!isWithinArea(local, areaW, areaH)) return; // over a ruler ⇒ hidden

    const lineWidth = cross.line_width || 1;
    const armLength = computeArmLength(areaW, areaH, cross.size_percent ?? 50);
    const gap = computeCenterGap({
      showCenterSquare: showAperture,
      centerSquareSize: apertureSize,
      useCursorGap: cross.use_cursor_gap ?? false,
      centerGapPx: cross.center_gap_px ?? 5,
    });
    // ADR-515 — centre square hidden while a snap marker glues the centre.
    const apertureVisible = showAperture && apertureSize > 0 && !snapActiveRef.current;
    // ADR-538 — text/colour decision via the shared SSoT (one badge code, 2D + 3D).
    const badgeView = resolveHoverBadge(
      hoveredEntityIdRef.current || hoveredOverlayIdRef.current,
      shiftHeldRef.current,
    );

    paintCrosshairFrame(ctx, {
      cx: pos.x,
      cy: pos.y,
      clip: { x: m.left, y: m.top, w: areaW, h: areaH },
      color: cross.color,
      opacity: cross.opacity ?? 1,
      lineWidth,
      lineStyle: (cross.line_style ?? 'solid') as CrosshairLineStyle,
      armLength,
      gap,
      aperture: { visible: apertureVisible, size: apertureSize },
      badge: badgeView.visible
        ? { visible: true, text: badgeView.text, color: badgeView.color, backgroundColor: badgeView.backgroundColor }
        : { visible: false },
    });

    // Record exactly the bands we painted so the NEXT frame clears them (and nothing else).
    lastClearRef.current = computeCrosshairClearRects({
      cx: pos.x,
      cy: pos.y,
      armLength,
      gap,
      lineWidth,
      aperture: apertureVisible ? apertureSize : 0,
      badge: badgeView.visible,
    });
  }, [showAperture, apertureSize]);

  // PER-MOVE TRANSFORM — store the position and repaint synchronously.
  const applyTransform = useCallback((pos: Point2D | null) => {
    lastPosRef.current = pos;
    draw();
  }, [draw]);

  // Snap-active setter (host drives it from its snap store). Repaint only on change.
  const setSnapActive = useCallback((value: boolean) => {
    if (value === snapActiveRef.current) return;
    snapActiveRef.current = value;
    draw();
  }, [draw]);

  // Expose the imperative driver surface to the host wrapper.
  useImperativeHandle(ref, () => ({ applyTransform, setSnapActive }), [applyTransform, setSnapActive]);

  // Recompute drawable-area size (overlay minus ruler margins) + size the canvas backing store at
  // DPR + (re)acquire the desynchronized context, then repaint. Runs on resize / margin / active
  // change — NEVER per move (the move path reads only cached size/dpr).
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = getDevicePixelRatio();
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const dw = Math.round(cw * dpr);
    const dh = Math.round(ch * dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    if (!ctxRef.current) {
      // ADR-549 Phase 6 — low-latency present hint (the whole point of the canvas migration).
      // 🔬 A/B (REVERTIBLE): `localStorage['dxf-crosshair-no-desync']==='1'` disables the hint so we
      // can confirm whether the periodic «trails» are the desynchronized single-buffer artifact
      // (low-latency present beating the clear) vs a clear bug. Default ON (low-latency).
      const desync =
        typeof window === 'undefined' || window.localStorage.getItem('dxf-crosshair-no-desync') !== '1';
      ctxRef.current = canvas.getContext('2d', { desynchronized: desync });
    }
    ctxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = marginsRef.current;
    areaSizeRef.current = {
      w: Math.max(0, cw - m.left),
      h: Math.max(0, ch - m.top - (m.bottom ?? 0)),
    };
    draw();
  }, [draw]);

  // ResizeObserver: react to layout/size changes (ADR-146 intent, element-level).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [resize]);

  // Re-apply on prop changes (margins / active toggle).
  useEffect(() => {
    resize();
  }, [rulerMargins, isActive, resize]);

  // ADR-549 Phase 7 — re-size the backing store on a devicePixelRatio change (monitor/scaling
  // switch fires no ResizeObserver). `resize` re-reads `getDevicePixelRatio()`.
  useEffect(() => subscribeDevicePixelRatio(resize), [resize]);

  // Settings subscription — colours/sizes/gap change ⇒ repaint (not per move).
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings((newSettings) => {
      settingsRef.current = newSettings;
      draw();
    });
    return unsubscribe;
  }, [draw]);

  // ADR-513 — repaint όταν αλλάζει το crosshair-suppression flag χωρίς κίνηση ποντικιού
  // (π.χ. το NavWheel ξεμοντάρεται ενώ ο κέρσορας μένει ακίνητος). No-op in 3D (always false).
  useEffect(() => subscribeCrosshairSuppression(draw), [draw]);

  // Selection badge: hover changes + Shift key (low-frequency) ⇒ repaint.
  useEffect(() => {
    const trigger = (): void => draw();
    const unsubHover = subscribeHoveredEntity(() => {
      hoveredEntityIdRef.current = getHoveredEntity();
      trigger();
    });
    const unsubOverlayHover = subscribeHoveredOverlay(() => {
      hoveredOverlayIdRef.current = getHoveredOverlay();
      trigger();
    });
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') { shiftHeldRef.current = true; trigger(); }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') { shiftHeldRef.current = false; trigger(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      unsubHover();
      unsubOverlayHover();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [draw]);

  return (
    <div
      ref={containerRef}
      data-dxf-overlay="crosshair"
      className={className}
      style={{
        ...style,
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: portalComponents.overlay.crosshair.zIndex(),
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  );
});
