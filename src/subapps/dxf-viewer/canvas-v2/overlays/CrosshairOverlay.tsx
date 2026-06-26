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
 * top/bottom). The center gap is the translate offset between them, baked so the
 * arms stop at the outer faces of the single centre square (the white aperture /
 * APBOX) — there is therefore always a hole inside the square (ADR-515). Every
 * element only ever changes its `transform`, so there is zero per-move layout/paint.
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
// ADR-515 — κρύψε το κεντρικό τετράγωνο (aperture/APBOX) όταν φωτίζεται έλξη (το marker κουμπώνει το κέντρο).
import { getFullSnapResult, subscribeSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import { toSnapIndicatorView, isSnapMarkerVisible } from '../../snapping/extended-types';
// ADR-513 — κρύψε το σταυρόνημα όταν ο κέρσορας μπαίνει στα πλήκτρα του «Δαχτυλιδιού Εντολών».
import { isCrosshairSuppressed, subscribeCrosshairSuppression } from '../../systems/cursor/CrosshairSuppressionStore';
import { getHoveredEntity, subscribeHoveredEntity, getHoveredOverlay, subscribeHoveredOverlay } from '../../systems/hover/HoverStore';
// ADR-538 — the "+"/"−" badge text+colours are a shared SSoT (reused by the 3D viewport badge).
import { resolveHoverBadge } from '../../systems/hover/hover-add-badge';
import {
  computeArmLength,
  computeSegmentBoxes,
  computeCenterGap,
  computeBadgeOffset,
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

/**
 * Base style for the crosshair parts. They are positioned STATICALLY (left/top)
 * relative to the single moving layer and never change their own `transform`,
 * so they carry no `will-change` (that lives on the one promoted layer below).
 */
const SEGMENT_BASE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
};

/**
 * The ONE promoted compositor layer that holds the whole crosshair. It is the
 * only element that changes `transform` per move — a single `translate3d` to the
 * cursor — so each move is one compositor translate (one display-list item)
 * rather than 6-8 independently-moving promoted divs. `isolation: isolate` keeps
 * it in its own stacking context so its repaints never reach the scene below.
 */
const CROSS_LAYER_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  willChange: 'transform',
  isolation: 'isolate',
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
  const crossLayerRef = useRef<HTMLDivElement>(null);
  const segLeftRef = useRef<HTMLDivElement>(null);
  const segRightRef = useRef<HTMLDivElement>(null);
  const segTopRef = useRef<HTMLDivElement>(null);
  const segBottomRef = useRef<HTMLDivElement>(null);
  const apertureRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const settingsRef = useRef<CursorSettings>(getCursorSettings());
  const hoveredEntityIdRef = useRef<string | null>(getHoveredEntity());
  const hoveredOverlayIdRef = useRef<string | null>(getHoveredOverlay());
  const shiftHeldRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(isActive);
  const marginsRef = useRef(rulerMargins);
  const areaSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // ADR-515 — true όταν φωτίζεται έλξη (snap marker ορατός) ⇒ κρύψε το κεντρικό τετράγωνο.
  const snapActiveRef = useRef<boolean>(false);

  // Keep event-time refs current (read inside the compositor callbacks).
  isActiveRef.current = isActive;
  marginsRef.current = rulerMargins;

  const { gripSettings } = useGripContext();
  const { showAperture, apertureSize } = gripSettings;

  // ============================================================================
  // ADR-515 — CENTRE-SQUARE VISIBILITY (ΕΝΑ σημείο). Το λευκό κεντρικό τετράγωνο
  // (aperture/APBOX) κρύβεται αν δεν ζητείται (showAperture) Ή αν φωτίζεται έλξη
  // (το snap marker κουμπώνει το κέντρο, οπότε το τετράγωνο περισσεύει — Giorgio
  // 2026-06-24). Γράφει μόνο `display`. Είναι ο ΜΟΝΟΣ snap-hide μηχανισμός (το
  // πράσινο pickbox αφαιρέθηκε — μηδέν διπλότυπο).
  // ============================================================================
  const updateApertureVisibility = useCallback(() => {
    const ap = apertureRef.current;
    if (!ap) return;
    ap.style.display = showAperture && apertureSize > 0 && !snapActiveRef.current ? '' : 'none';
  }, [showAperture, apertureSize]);

  // ============================================================================
  // STATIC STYLES — sizes/colours/boxes + the gap-baked positions of every part.
  // Runs on settings / size / pick-box change (rare), NEVER per mouse move. Each
  // part sits at a fixed offset from the crosshair centre (0,0); the whole cross
  // is then moved as ONE layer in `applyTransform`.
  // ============================================================================
  const applyStaticStyles = useCallback(() => {
    const cross = settingsRef.current.crosshair;
    if (!cross) return;
    const { w: areaW, h: areaH } = areaSizeRef.current;
    const lineWidth = cross.line_width || 1;
    const arm = computeArmLength(areaW, areaH, cross.size_percent ?? 50);
    // Task 2 (ADR-515): οι 4 γραμμές σταματούν στις παρειές του κεντρικού τετραγώνου
    // (aperture) → πάντα τρύπα στο εσωτερικό του. Το gap προέρχεται από το apertureSize.
    const gap = computeCenterGap({
      showCenterSquare: showAperture,
      centerSquareSize: apertureSize,
      useCursorGap: cross.use_cursor_gap ?? false,
      centerGapPx: cross.center_gap_px ?? 5,
    });
    const boxes = computeSegmentBoxes(arm, lineWidth, gap);
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

    // Κεντρικό τετράγωνο (AutoCAD aperture / APBOX) — λευκό, ΕΝΑ τετράγωνο στο κέντρο
    // (το πράσινο pickbox αφαιρέθηκε, Giorgio 2026-06-24). Sizes/χρώμα εδώ· η ορατότητα
    // (incl. snap-hide) καθορίζεται κεντρικά από το updateApertureVisibility().
    const ap = apertureRef.current;
    if (ap && showAperture && apertureSize > 0) {
      ap.style.width = `${apertureSize}px`;
      ap.style.height = `${apertureSize}px`;
      ap.style.left = `${-apertureSize / 2}px`;
      ap.style.top = `${-apertureSize / 2}px`;
      ap.style.border = `1px solid ${cross.color}`;
      ap.style.opacity = opacity;
    }
    updateApertureVisibility();

    // Selection badge static position (top-right of the centre gap). Its text /
    // colour / visibility are driven by hover + Shift in `applyBadge`.
    const badge = badgeRef.current;
    if (badge) {
      const offset = computeBadgeOffset(gap);
      badge.style.left = `${offset}px`;
      badge.style.top = `${-offset - 11}px`;
    }
  }, [showAperture, apertureSize, updateApertureVisibility]);

  // ============================================================================
  // SELECTION BADGE — AutoCAD-style "+"/"−" at the centre gap. Driven by hover /
  // Shift changes (low-frequency), NOT per move. Position is static (set above).
  // ============================================================================
  const applyBadge = useCallback(() => {
    const badge = badgeRef.current;
    if (!badge) return;
    // ADR-538 — text/colour decision via the shared SSoT (mirrors the 3D viewport badge).
    const view = resolveHoverBadge(
      hoveredEntityIdRef.current || hoveredOverlayIdRef.current,
      shiftHeldRef.current,
    );
    if (view.visible) {
      badge.textContent = view.text;
      badge.style.color = view.color;
      badge.style.backgroundColor = view.backgroundColor;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }, []);

  // ============================================================================
  // PER-MOVE TRANSFORM — the ONLY thing called on every mouse move. Writes a
  // SINGLE `translate3d` to the one promoted layer (+ container visibility), so
  // the whole cross moves as one GPU composite — one display-list item, not 6-8.
  // ============================================================================
  const applyTransform = useCallback((pos: Point2D | null) => {
    const container = containerRef.current;
    if (!container) return;
    const cross = settingsRef.current.crosshair;
    // ADR-513 — όταν ο κέρσορας είναι πάνω στα πλήκτρα του NavWheel, εξαφάνισε το σταυρόνημα.
    const active = isActiveRef.current && !!pos && (cross?.enabled ?? false) && !isCrosshairSuppressed();
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

    const layer = crossLayerRef.current;
    if (layer) layer.style.transform = translate3d(local.x, local.y);
  }, []);

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
    applyBadge();
    applyTransform(getImmediatePosition());
  }, [applyStaticStyles, applyBadge, applyTransform]);

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
      applyBadge();
      applyTransform(getImmediatePosition());
    });
    return unsubscribe;
  }, [applyStaticStyles, applyBadge, applyTransform]);

  // 🚀 DIRECT RENDER: synchronous, zero-latency, compositor-only position update.
  useEffect(() => registerDirectRender((pos) => applyTransform(pos)), [applyTransform]);

  // ADR-515 — όταν φωτίζεται/σβήνει έλξη, κρύψε/δείξε το κεντρικό τετράγωνο. Γράφει DOM
  // ΜΟΝΟ όταν αλλάζει το active state (όχι ανά snap update), συμβατό με ADR-040 (κανένα re-render).
  useEffect(() => {
    const refresh = (): void => {
      const active = isSnapMarkerVisible(toSnapIndicatorView(getFullSnapResult()));
      if (active !== snapActiveRef.current) {
        snapActiveRef.current = active;
        updateApertureVisibility();
      }
    };
    refresh(); // initial sync
    return subscribeSnapResult(refresh);
  }, [updateApertureVisibility]);

  // ADR-513 — re-apply όταν αλλάζει το crosshair-suppression flag χωρίς κίνηση ποντικιού
  // (π.χ. το NavWheel ξεμοντάρεται ενώ ο κέρσορας μένει ακίνητος).
  useEffect(
    () => subscribeCrosshairSuppression(() => applyTransform(getImmediatePosition())),
    [applyTransform],
  );

  // Selection badge: hover changes + Shift key (low-frequency). The badge rides
  // the moving layer, so only its text/colour/visibility change here — never a
  // per-move transform.
  useEffect(() => {
    const trigger = (): void => applyBadge();
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
  }, [applyBadge]);

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
        <div ref={crossLayerRef} style={CROSS_LAYER_STYLE}>
          <div ref={segLeftRef} style={SEGMENT_BASE} />
          <div ref={segRightRef} style={SEGMENT_BASE} />
          <div ref={segTopRef} style={SEGMENT_BASE} />
          <div ref={segBottomRef} style={SEGMENT_BASE} />
          <div ref={apertureRef} style={{ ...SEGMENT_BASE, display: 'none' }} />
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
    </div>
  );
}
