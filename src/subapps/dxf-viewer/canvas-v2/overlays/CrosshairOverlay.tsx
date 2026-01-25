'use client';

/**
 * 🏢 ENTERPRISE CROSSHAIR OVERLAY
 *
 * CAD-grade crosshair rendering with centralized cursor position from CursorSystem.
 * Pattern: Autodesk AutoCAD/Revit - Single Source of Truth for cursor position
 *
 * @module CrosshairOverlay
 * @version 3.0.0 - Enterprise UnifiedFrameScheduler Integration (ADR-030)
 * @since 2025-01-25
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Uses centralized CursorSystem for mouse position (ZERO duplicate tracking)
 * - Uses UnifiedFrameScheduler for coordinated rendering (ADR-030)
 * - ADR-008 compliant: CSS→Canvas coordinate contract
 * - High-DPI support with setTransform(dpr)
 * - Dirty-flag optimized (skips render if position unchanged)
 * - Full TypeScript support (ZERO any)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../../systems/cursor/config';
import { useCursorState } from '../../systems/cursor/useCursor';
import { useGripContext } from '../../providers/GripProvider';
import { portalComponents } from '@/styles/design-tokens';
import type { Point2D } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ✅ ADR-030: UnifiedFrameScheduler Integration
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';

interface Viewport {
  width: number;
  height: number;
}

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  viewport?: Viewport;
  /** ✅ ENTERPRISE: Ruler margins για να μην σχεδιάζεται το crosshair πάνω στους rulers */
  rulerMargins?: {
    left: number;
    top: number;
    bottom: number;
  };
  /** ✅ ADR-007: Style prop για CAD-grade layout (height excludes ruler) */
  style?: React.CSSProperties;
}

export default function CrosshairOverlay({
  className = '',
  isActive = true,
  viewport = { width: 0, height: 0 },
  rulerMargins = { left: 30, top: 0, bottom: 0 },
  style,
}: CrosshairOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============================================================================
  // 🏢 ENTERPRISE: Centralized Cursor Position from CursorSystem
  // Pattern: Autodesk/Adobe - Single Source of Truth
  // ============================================================================

  const { position: cursorPosition } = useCursorState();

  // ✅ ENTERPRISE: Combine component isActive with cursor position
  const effectiveIsActive = isActive && cursorPosition !== null;

  // ✅ ADR-030: Track previous state for dirty check
  const prevPositionRef = useRef<Point2D | null>(null);
  const prevIsActiveRef = useRef<boolean>(false); // Start false - first render always dirty
  const hasRenderedOnceRef = useRef<boolean>(false); // Track first render

  // ============================================================================
  // 🏢 ENTERPRISE: Settings Subscription (singleton pattern)
  // ============================================================================

  const settingsRef = useRef<CursorSettings>(getCursorSettings());

  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings((newSettings) => {
      settingsRef.current = newSettings;
    });
    return unsubscribe;
  }, []);

  // === GRIP SETTINGS INTEGRATION ===
  const { gripSettings } = useGripContext();

  // ============================================================================
  // 🏢 ENTERPRISE: Canvas Size Management via ResizeObserver
  // Pattern: ADR-008 - Canvas size from actual layout, not from props
  // ============================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const cssWidth = rect.width;
      const cssHeight = rect.height;

      if (cssWidth === 0 || cssHeight === 0) return;

      const w = Math.round(cssWidth * dpr);
      const h = Math.round(cssHeight * dpr);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = settingsRef.current.performance.precision_mode;
        }
      }
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  // ============================================================================
  // 🏢 ENTERPRISE: Crosshair Render Function
  // CAD-grade rendering with pixel-perfect alignment
  // ============================================================================

  const renderCrosshair = useCallback((opts: {
    isActive: boolean;
    pos: Point2D | null;
    margins: { left: number; top: number; bottom?: number };
  }) => {
    const { isActive: active, pos, margins } = opts;
    const settings = settingsRef.current;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // ✅ CAD-GRADE: Reset transform and clear entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ RESTORE DPR TRANSFORM
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ✅ Early exit after clear
    if (!active || !pos) return;
    if (!settings.crosshair?.enabled) return;

    const activeSettings = settings.crosshair;
    const sizePercent = activeSettings.size_percent ?? 50;

    // ✅ CAD-GRADE: Canvas dimensions
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    // ✅ ADR-008: Pixel-perfect alignment
    const mouseX = Math.round(pos.x) + 0.5;
    const mouseY = Math.round(pos.y) + 0.5;

    // Calculate crosshair dimensions
    const crosshairHalfWidth = (canvasWidth / 2) * (sizePercent / 100);
    const crosshairHalfHeight = (canvasHeight / 2) * (sizePercent / 100);

    // Center gap calculation
    const pickboxSize = gripSettings.pickBoxSize * dpr;
    const centerGap = Math.max(pickboxSize + 4, settings.crosshair.center_gap_px || 5);

    // Setup drawing style
    ctx.strokeStyle = activeSettings.color;
    ctx.lineWidth = activeSettings.line_width;
    ctx.lineCap = 'square';
    ctx.globalAlpha = activeSettings.opacity || 1.0;

    // ✅ CAD-GRADE: Visibility check
    const bottomLimit = canvasHeight - (margins.bottom ?? 0);
    if (mouseX < margins.left || mouseY < margins.top || mouseY > bottomLimit) {
      return;
    }

    // Only draw if size > 0
    if (sizePercent > 0) {
      let actualHalfWidth: number;
      let actualHalfHeight: number;

      if (sizePercent === 100) {
        actualHalfWidth = Math.max(mouseX - margins.left, canvasWidth - mouseX);
        actualHalfHeight = Math.max(mouseY - margins.top, bottomLimit - mouseY);
      } else {
        actualHalfWidth = crosshairHalfWidth;
        actualHalfHeight = crosshairHalfHeight;
      }

      // Draw horizontal lines
      ctx.beginPath();
      const leftStart = Math.max(margins.left, mouseX - actualHalfWidth);
      const leftEnd = mouseX - centerGap;
      if (leftEnd > leftStart) {
        ctx.moveTo(leftStart, mouseY);
        ctx.lineTo(leftEnd, mouseY);
      }

      const rightStart = mouseX + centerGap;
      const rightEnd = Math.min(canvasWidth, mouseX + actualHalfWidth);
      if (rightStart < rightEnd) {
        ctx.moveTo(rightStart, mouseY);
        ctx.lineTo(rightEnd, mouseY);
      }
      ctx.stroke();

      // Draw vertical lines
      ctx.beginPath();
      const topStart = Math.max(margins.top, mouseY - actualHalfHeight);
      const topEnd = mouseY - centerGap;
      if (topEnd > topStart) {
        ctx.moveTo(mouseX, topStart);
        ctx.lineTo(mouseX, topEnd);
      }

      const bottomStart = mouseY + centerGap;
      const bottomEnd = Math.min(bottomLimit, mouseY + actualHalfHeight);
      if (bottomStart < bottomEnd) {
        ctx.moveTo(mouseX, bottomStart);
        ctx.lineTo(mouseX, bottomEnd);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }, [gripSettings]);

  // ============================================================================
  // 🏢 ENTERPRISE: UnifiedFrameScheduler Integration (ADR-030)
  // Single RAF loop coordinates all render systems
  // ============================================================================

  // ✅ Store current render args in ref for scheduler callback
  // 🏢 ENTERPRISE FIX: Update SYNCHRONOUSLY during render (not in useEffect)
  // This ensures RAF callback always has the latest state
  const renderArgsRef = useRef<{
    isActive: boolean;
    pos: Point2D | null;
    margins: { left: number; top: number; bottom?: number };
  }>({
    isActive: false,
    pos: null,
    margins: rulerMargins
  });

  // ✅ SYNCHRONOUS UPDATE: Write to ref during render phase (not in useEffect)
  // This ensures the RAF callback always reads the current React state
  renderArgsRef.current = {
    isActive: effectiveIsActive,
    pos: cursorPosition,
    margins: rulerMargins
  };

  // ✅ ADR-030: Register with UnifiedFrameScheduler
  useEffect(() => {
    /**
     * 🏢 ENTERPRISE: Dirty Check Function
     * Returns true only if crosshair needs to be redrawn
     * Pattern: Autodesk/Adobe - Skip render if nothing changed
     */
    const isDirty = (): boolean => {
      const currentPos = renderArgsRef.current.pos;
      const currentActive = renderArgsRef.current.isActive;

      // 🏢 ENTERPRISE: First render is ALWAYS dirty (to clear canvas initially)
      if (!hasRenderedOnceRef.current) {
        return true;
      }

      // Check if active state changed
      if (prevIsActiveRef.current !== currentActive) {
        return true;
      }

      // Check if position changed significantly (> 0.5px movement)
      const prevPos = prevPositionRef.current;

      // If one is null and the other isn't, it's dirty
      if ((prevPos === null) !== (currentPos === null)) {
        return true;
      }

      // Both are non-null - check for significant movement
      if (prevPos && currentPos) {
        const dx = Math.abs(prevPos.x - currentPos.x);
        const dy = Math.abs(prevPos.y - currentPos.y);
        if (dx > 0.5 || dy > 0.5) {
          return true;
        }
      }

      return false;
    };

    /**
     * 🏢 ENTERPRISE: Render Callback
     * Called by UnifiedFrameScheduler on each frame (if dirty)
     */
    const onRender = (): void => {
      const args = renderArgsRef.current;

      // Mark first render complete
      hasRenderedOnceRef.current = true;

      // Update previous state after render
      prevIsActiveRef.current = args.isActive;
      prevPositionRef.current = args.pos ? { ...args.pos } : null;

      // Perform the actual render
      renderCrosshair(args);
    };

    // ✅ Register with CRITICAL priority (crosshair must render every frame when dirty)
    const unsubscribe = registerRenderCallback(
      'crosshair-overlay',
      'Crosshair Overlay',
      RENDER_PRIORITIES.CRITICAL,
      onRender,
      isDirty
    );

    return () => {
      unsubscribe();
    };
  }, [renderCrosshair]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
      style={{
        ...style,
        width: '100%',
        height: '100%',
        zIndex: portalComponents.overlay.crosshair.zIndex()
      }}
    />
  );
}

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ Uses centralized CursorSystem for mouse position (ZERO duplicate tracking)
 * ✅ Uses UnifiedFrameScheduler for coordinated rendering (ADR-030)
 * ✅ ADR-008 compliant: CSS→Canvas coordinate contract
 * ✅ Dirty-flag optimization (skips render if position unchanged)
 * ✅ CRITICAL priority (renders every frame when dirty)
 * ✅ ResizeObserver for canvas sizing
 * ✅ High-DPI support with setTransform(dpr)
 * ✅ Pixel-perfect alignment (+0.5 for crisp lines)
 * ✅ Full TypeScript support (ZERO any)
 * ✅ Settings via singleton pattern with subscription
 * ✅ Proper cleanup via unsubscribe
 */
