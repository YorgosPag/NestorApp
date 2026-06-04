'use client';

/**
 * 🏢 ENTERPRISE CROSSHAIR OVERLAY — Compositor edition (ADR-040)
 *
 * CAD-grade crosshair, AutoCAD/Revit pattern: the cross is built ONCE as promoted
 * DOM elements and moved purely with `transform: translate3d(...)` on the GPU
 * compositor — OFF the main thread. It therefore tracks the pointer 1:1 no matter
 * how busy the main thread is (snap, hover, React commits, bitmap rebuilds).
 *
 * Why this replaces the previous main-thread `<canvas>` crosshair: the old version
 * repainted the whole canvas on every position change inside `ImmediatePositionStore`;
 * under load the compositor could not present the freshly-painted crosshair until the
 * main thread freed up, so the drawn cursor visibly trailed the physical mouse.
 *
 * Geometry / gap: each axis is split into two FIXED-size segments (left/right,
 * top/bottom). The center gap is the translate offset between them. Every element
 * only ever changes its `transform`, so there is zero per-move layout/paint.
 *
 * The position SSoT is still `ImmediatePositionStore` via `registerDirectRender`
 * (called synchronously from the mouse handler) — now the callback only writes
 * `transform` strings instead of issuing canvas draw calls.
 *
 * @module CrosshairOverlay
 * @version 4.0.0 — Compositor crosshair (2026-06-04, ADR-040)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../../systems/cursor/config';
import { useGripContext } from '../../providers/GripProvider';
import { portalComponents } from '@/styles/design-tokens';
import type { Point2D } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized ruler margins from Single Source of Truth
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
// 🚀 PERFORMANCE: ImmediatePositionStore for zero-latency crosshair updates
import { registerDirectRender, getImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import { getHoveredEntity, subscribeHoveredEntity, getHoveredOverlay, subscribeHoveredOverlay } from '../../systems/hover/HoverStore';
import {
  computeArmLength,
  computeSegmentBoxes,
  computeCenterGap,
  toAreaLocal,
  isWithinArea,
  translate3d,
  segmentBackground,
  type CrosshairLineStyle,
  type SegmentBox,
} from './crosshair-compositor-layout';

interface Viewport {
  width: number;
  height: number;
}

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  viewport?: Viewport;
  /** ✅ ENTERPRISE: Ruler margins so the crosshair is not drawn over the rulers. */
  rulerMargins?: {
    left: number;
    top: number;
    bottom: number;
  };
  /** ✅ ADR-007: Style prop for CAD-grade layout (height excludes ruler). */
  style?: React.CSSProperties;
  /** AutoCAD-style selection indicator: returns true if entity is currently selected. */
  isEntitySelected?: (id: string) => boolean;
}

/** Base style shared by the 4 line segments — only `transform` changes per move. */
const SEGMENT_BASE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  willChange: 'transform',
  pointerEvents: 'none',
};

export default function CrosshairOverlay({
  className = '',
  isActive = true,
  rulerMargins = COORDINATE_LAYOUT.MARGINS,
  style,
  isEntitySelected,
}: CrosshairOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const segLeftRef = useRef<HTMLDivElement>(null);
  const segRightRef = useRef<HTMLDivElement>(null);
  const segTopRef = useRef<HTMLDivElement>(null);
  const segBottomRef = useRef<HTMLDivElement>(null);
  const pickboxRef = useRef<HTMLDivElement>(null);
  const apertureRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const settingsRef = useRef<CursorSettings>(getCursorSettings());
  const hoveredEntityIdRef = useRef<string | null>(getHoveredEntity());
  const hoveredOverlayIdRef = useRef<string | null>(getHoveredOverlay());
  const shiftHeldRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(isActive);
  const marginsRef = useRef(rulerMargins);
  const areaSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Keep event-time refs current (read inside the compositor callbacks).
  isActiveRef.current = isActive;
  marginsRef.current = rulerMargins;

  const { gripSettings } = useGripContext();
  const { pickBoxSize, showAperture, apertureSize } = gripSettings;

  // ============================================================================
  // STATIC STYLES — sizes/colours/boxes. Runs on settings or size change (rare),
  // NEVER per mouse move. Mutating left/top/width here is the only layout cost.
  // ============================================================================
  const applyStaticStyles = useCallback(() => {
    const cross = settingsRef.current.crosshair;
    if (!cross) return;
    const { w: areaW, h: areaH } = areaSizeRef.current;
    const lineWidth = cross.line_width || 1;
    const arm = computeArmLength(areaW, areaH, cross.size_percent ?? 50);
    const boxes = computeSegmentBoxes(arm, lineWidth);
    const opacity = String(cross.opacity ?? 1);
    const lineStyle = (cross.line_style ?? 'solid') as CrosshairLineStyle;

    const setSeg = (el: HTMLDivElement | null, box: SegmentBox, orient: 'horizontal' | 'vertical') => {
      if (!el) return;
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
      el.style.left = `${box.left}px`;
      el.style.top = `${box.top}px`;
      el.style.opacity = opacity;
      el.style.backgroundColor = '';
      el.style.backgroundImage = '';
      const bg = segmentBackground(orient, lineStyle, cross.color);
      if (bg.backgroundColor) el.style.backgroundColor = bg.backgroundColor;
      if (bg.backgroundImage) el.style.backgroundImage = bg.backgroundImage;
    };
    setSeg(segLeftRef.current, boxes.left, 'horizontal');
    setSeg(segRightRef.current, boxes.right, 'horizontal');
    setSeg(segTopRef.current, boxes.top, 'vertical');
    setSeg(segBottomRef.current, boxes.bottom, 'vertical');

    // Cursor pick box (circle or square at the crosshair centre).
    const pb = pickboxRef.current;
    const cur = settingsRef.current.cursor;
    if (pb) {
      if (cur?.enabled) {
        pb.style.display = '';
        pb.style.width = `${cur.size}px`;
        pb.style.height = `${cur.size}px`;
        pb.style.left = `${-cur.size / 2}px`;
        pb.style.top = `${-cur.size / 2}px`;
        pb.style.border = `${cur.line_width || 1}px solid ${cur.color}`;
        pb.style.borderRadius = cur.shape === 'circle' ? '50%' : '0';
        pb.style.opacity = String(cur.opacity ?? 1);
      } else {
        pb.style.display = 'none';
      }
    }

    // Aperture box (AutoCAD APBOX) — snap acquisition zone indicator.
    const ap = apertureRef.current;
    if (ap) {
      if (showAperture && apertureSize > 0) {
        ap.style.display = '';
        ap.style.width = `${apertureSize}px`;
        ap.style.height = `${apertureSize}px`;
        ap.style.left = `${-apertureSize / 2}px`;
        ap.style.top = `${-apertureSize / 2}px`;
        ap.style.border = `1px solid ${cross.color}`;
        ap.style.opacity = opacity;
      } else {
        ap.style.display = 'none';
      }
    }
  }, [showAperture, apertureSize]);

  // ============================================================================
  // PER-MOVE TRANSFORM — the ONLY thing called on every mouse move. Writes only
  // `transform` (+ visibility), so the move is fully GPU-composited.
  // ============================================================================
  const applyTransform = useCallback((pos: Point2D | null) => {
    const container = containerRef.current;
    if (!container) return;
    const cross = settingsRef.current.crosshair;
    const active = isActiveRef.current && !!pos && (cross?.enabled ?? false);
    if (!active || !pos) {
      container.style.visibility = 'hidden';
      return;
    }
    const local = toAreaLocal(pos, marginsRef.current);
    const { w: areaW, h: areaH } = areaSizeRef.current;
    if (!isWithinArea(local, areaW, areaH)) {
      container.style.visibility = 'hidden';
      return;
    }
    container.style.visibility = 'visible';

    const gap = computeCenterGap({
      useCursorGap: cross?.use_cursor_gap ?? false,
      centerGapPx: cross?.center_gap_px ?? 5,
      pickBoxSize,
    });
    const { x, y } = local;
    if (segLeftRef.current) segLeftRef.current.style.transform = translate3d(x - gap, y);
    if (segRightRef.current) segRightRef.current.style.transform = translate3d(x + gap, y);
    if (segTopRef.current) segTopRef.current.style.transform = translate3d(x, y - gap);
    if (segBottomRef.current) segBottomRef.current.style.transform = translate3d(x, y + gap);
    if (pickboxRef.current) pickboxRef.current.style.transform = translate3d(x, y);
    if (apertureRef.current) apertureRef.current.style.transform = translate3d(x, y);

    // AutoCAD-style "+"/"−" badge at the top-right of the centre gap.
    const badge = badgeRef.current;
    if (badge) {
      const hoveredId = hoveredEntityIdRef.current || hoveredOverlayIdRef.current;
      if (hoveredId) {
        const add = !shiftHeldRef.current;
        badge.textContent = add ? '+' : '−';
        badge.style.color = add ? '#44FF88' : '#FF5555';
        badge.style.backgroundColor = add ? '#0d2b0d' : '#2b0d0d';
        const offset = Math.max(gap, 4) + 2;
        badge.style.transform = translate3d(x + offset, y - offset - 11);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }, [pickBoxSize]);

  // Recompute drawable-area size (overlay minus ruler margins) + re-apply styles.
  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const m = marginsRef.current;
      areaSizeRef.current = {
        w: Math.max(0, rect.width - m.left),
        h: Math.max(0, rect.height - m.top - (m.bottom ?? 0)),
      };
    }
    applyStaticStyles();
    applyTransform(getImmediatePosition());
  }, [applyStaticStyles, applyTransform]);

  // ResizeObserver: react to layout/size changes (ADR-146 intent, element-level).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [recompute]);

  // Re-apply on prop changes (margins / active toggle).
  useEffect(() => {
    recompute();
  }, [rulerMargins, isActive, recompute]);

  // Settings subscription — colours/sizes/gap change ⇒ restyle (not per move).
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings((newSettings) => {
      settingsRef.current = newSettings;
      applyStaticStyles();
      applyTransform(getImmediatePosition());
    });
    return unsubscribe;
  }, [applyStaticStyles, applyTransform]);

  // 🚀 DIRECT RENDER: synchronous, zero-latency, compositor-only position update.
  useEffect(() => registerDirectRender((pos) => applyTransform(pos)), [applyTransform]);

  // Selection badge: hover changes + Shift key (low-frequency).
  useEffect(() => {
    const trigger = (): void => applyTransform(getImmediatePosition());
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
  }, [applyTransform]);

  return (
    <div
      ref={containerRef}
      data-dxf-overlay="crosshair"
      className={`${className} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
      style={{
        ...style,
        width: '100%',
        height: '100%',
        visibility: 'hidden',
        zIndex: portalComponents.overlay.crosshair.zIndex(),
      }}
    >
      <div
        ref={areaRef}
        style={{
          position: 'absolute',
          left: rulerMargins.left,
          top: rulerMargins.top,
          right: 0,
          bottom: rulerMargins.bottom ?? 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div ref={segLeftRef} style={SEGMENT_BASE} />
        <div ref={segRightRef} style={SEGMENT_BASE} />
        <div ref={segTopRef} style={SEGMENT_BASE} />
        <div ref={segBottomRef} style={SEGMENT_BASE} />
        <div ref={apertureRef} style={{ ...SEGMENT_BASE, display: 'none' }} />
        <div ref={pickboxRef} style={{ ...SEGMENT_BASE, display: 'none' }} />
        <div
          ref={badgeRef}
          style={{
            ...SEGMENT_BASE,
            display: 'none',
            width: 11,
            height: 11,
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            lineHeight: '11px',
            textAlign: 'center',
          }}
        />
      </div>
    </div>
  );
}
