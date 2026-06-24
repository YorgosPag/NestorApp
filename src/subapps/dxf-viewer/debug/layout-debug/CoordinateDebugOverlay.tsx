'use client';

/**
 * COORDINATE DEBUG OVERLAY — zero-React, compositor edition (ADR-040 cursor-lag Φ7).
 *
 * A developer diagnostic (gated by `LAYOUT_DEBUG_SYSTEM`) that shows live cursor
 * coordinates + a reference crosshair. It now follows the SAME zero-React pattern
 * as the production `CrosshairOverlay`: it subscribes to the cursor SSoT stores
 * and writes `textContent` / `transform` through refs — NO `useState`, NO React
 * commit per mouse move.
 *
 * WHY (the bug it fixes): the previous version did `setDisplayData(...)` on every
 * (throttled) mousemove → a 10fps React commit stream. Each commit briefly blocked
 * the main thread, so the compositor crosshair stuttered. Worse, the whole debug
 * system was mounted in production by a mis-wired flag (`ENTERPRISE_SETTINGS_
 * SHADOW_MODE` instead of `LAYOUT_DEBUG_SYSTEM`) — see `FloatingPanelsSection`.
 * Diagnostics must never tax the input hot path (Revit/AutoCAD-grade).
 *
 * @module debug/layout-debug/CoordinateDebugOverlay
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  getImmediatePosition,
  subscribeToImmediatePosition,
  getImmediateWorldPosition,
} from '../../systems/cursor/ImmediatePositionStore';
import { DXF_TIMING } from '../../config/dxf-timing';
import { getImmediateTransform, subscribeTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getCachedClientRect } from '../../rendering/core/pointer-rect-cache';
import { installCoordinateClipboardCopy } from './coordinate-clipboard-copy';
import {
  formatScreen,
  formatCanvas,
  formatWorld,
  formatScale,
  formatOffset,
  formatBoundsSize,
  formatBoundsPosition,
} from './coordinate-readout-format';
import styles from './DebugOverlay.module.css';
import { cn } from '@/lib/utils';

interface CoordinateDebugOverlayProps {
  className?: string;
}

/** Text readout throttle (10fps is plenty for a debug panel). */
const READOUT_THROTTLE_MS = DXF_TIMING.frame.READOUT; // ADR-516

export default function CoordinateDebugOverlay({ className = '' }: CoordinateDebugOverlayProps) {
  const screenRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLSpanElement>(null);
  const worldRef = useRef<HTMLSpanElement>(null);
  const scaleRef = useRef<HTMLSpanElement>(null);
  const offsetRef = useRef<HTMLSpanElement>(null);
  const boundsSizeRef = useRef<HTMLSpanElement>(null);
  const boundsPosRef = useRef<HTMLSpanElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const lastReadoutRef = useRef<number>(0);

  // Transform section — updates on zoom/pan even without a mouse move (low-freq).
  const renderTransform = useCallback((): void => {
    const t = getImmediateTransform();
    if (scaleRef.current) scaleRef.current.textContent = formatScale(t);
    if (offsetRef.current) offsetRef.current.textContent = formatOffset(t);
  }, []);

  // Per-move: crosshair tracks 1:1 (compositor); text readout throttled to 10fps.
  const renderPosition = useCallback((screen: Point2D | null): void => {
    if (!screen) return;
    if (crosshairRef.current) {
      crosshairRef.current.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-50%, -50%)`;
    }
    const now = performance.now();
    if (now - lastReadoutRef.current < READOUT_THROTTLE_MS) return;
    lastReadoutRef.current = now;

    const canvasEl = document.querySelector('.dxf-canvas') as HTMLElement | null;
    const rect = canvasEl ? getCachedClientRect(canvasEl) : null;
    const world = getImmediateWorldPosition() ?? { x: 0, y: 0 };

    if (screenRef.current) screenRef.current.textContent = formatScreen(screen);
    if (canvasRef.current) canvasRef.current.textContent = formatCanvas(screen, rect);
    if (worldRef.current) worldRef.current.textContent = formatWorld(world);
    if (rect) {
      if (boundsSizeRef.current) boundsSizeRef.current.textContent = formatBoundsSize(rect);
      if (boundsPosRef.current) boundsPosRef.current.textContent = formatBoundsPosition(rect);
    }
    renderTransform();
  }, [renderTransform]);

  useEffect(() => {
    const uninstallCopy = installCoordinateClipboardCopy();
    renderPosition(getImmediatePosition());
    renderTransform();
    const unsubPos = subscribeToImmediatePosition(renderPosition);
    const unsubTransform = subscribeTransform(renderTransform);
    return () => {
      uninstallCopy();
      unsubPos();
      unsubTransform();
    };
  }, [renderPosition, renderTransform]);

  return (
    <div className={cn(styles.debugOverlay, className)}>
      <div className={styles.overlayPositioned}>
        <div className={styles.sectionTitle}>🎯 LIVE COORDINATES</div>

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabel}>Screen:</span>
          <span ref={screenRef} className={styles.coordinateValue} />
        </div>

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabelCanvas}>Canvas:</span>
          <span ref={canvasRef} className={styles.coordinateValue} />
        </div>

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabelWorld}>World:</span>
          <span ref={worldRef} className={styles.coordinateValue} />
        </div>

        <div className={styles.dividerSection}>
          <div className={styles.subsectionTitle}>TRANSFORM</div>
          <div>Scale: <span ref={scaleRef} /></div>
          <div>Offset: <span ref={offsetRef} /></div>
        </div>

        <div className={styles.dividerSection}>
          <div className={styles.subsectionTitle}>CANVAS BOUNDS</div>
          <div>Size: <span ref={boundsSizeRef} /></div>
          <div>Position: <span ref={boundsPosRef} /></div>
        </div>

        <div className={styles.shortcutsSection}>
          <div className={styles.subsectionTitle}>📋 COPY SHORTCUTS</div>
          <div className={styles.shortcutItem}>F1: All data</div>
          <div className={styles.shortcutItem}>F2: Screen coords</div>
          <div className={styles.shortcutItem}>F3: World coords</div>
          <div className={styles.shortcutItem}>F4: Transform</div>
        </div>
      </div>

      {/* Reference crosshair — moved purely via transform (compositor, 1:1). */}
      <div ref={crosshairRef} className={styles.crosshairContainer}>
        <div className={styles.crosshairHorizontal} />
        <div className={styles.crosshairVertical} />
        <div className={styles.crosshairCenter} />
      </div>
    </div>
  );
}
