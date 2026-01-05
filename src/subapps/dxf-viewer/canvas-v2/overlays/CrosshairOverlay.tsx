'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../../systems/cursor/config';
import { useGripContext } from '../../providers/GripProvider';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
import type { Point2D } from '../../rendering/types/Types';

interface Viewport {
  width: number;
  height: number;
}

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  // ✅ ADR-008: REMOVED cursorPosition prop - now tracked internally for pixel-perfect alignment
  // cursorPosition?: Point2D | null;  // ❌ REMOVED - causes coordinate mismatch
  // mouseWorld?: Point2D | null;      // ❌ REMOVED - not needed for crosshair
  viewport?: Viewport;
  /** ✅ ENTERPRISE: Ruler margins για να μην σχεδιάζεται το crosshair πάνω στους rulers */
  rulerMargins?: {
    left: number;   // Κάθετος χάρακας (αριστερά)
    top: number;    // ΔΕΝ υπάρχει πάνω χάρακας, αλλά κρατάμε για toolbar offset
    bottom: number; // Οριζόντιος χάρακας (ΚΑΤΩ)
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
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());
  const rafRef = useRef<number>();

  // ✅ ADR-008: INTERNAL MOUSE TRACKING - Canvas-local coordinates for pixel-perfect alignment
  const [mousePos, setMousePos] = useState<Point2D | null>(null);

  // === GRIP SETTINGS INTEGRATION ===
  const { gripSettings } = useGripContext();

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  // ✅ ADR-008 + micro-ADR CSS→Canvas Coordinate Contract
  // The canvas uses setTransform(dpr) for HiDPI rendering, so we draw in CSS pixels
  // and the transform automatically scales to device pixels
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ✅ CAD-GRADE: Listen on window for mouse events
    // Get canvas-local CSS coordinates (NOT scaled by DPR)
    const handleWindowMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();

      // ✅ CSS→Canvas mapping: Get position relative to canvas element
      // These are CSS pixels - the setTransform(dpr) in render will handle HiDPI
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Check if mouse is inside canvas CSS bounds
      if (cssX >= 0 && cssX <= rect.width && cssY >= 0 && cssY <= rect.height) {
        setMousePos({ x: cssX, y: cssY });
      } else {
        setMousePos(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
    };
  }, []);

  // ✅ ADR-008: Canvas size from ACTUAL layout, not from props
  // This ensures the canvas matches exactly what CSS layout provides
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // ✅ Use actual CSS size from layout (not viewport prop)
      const cssWidth = rect.width;
      const cssHeight = rect.height;

      if (cssWidth === 0 || cssHeight === 0) return;

      const w = Math.round(cssWidth * dpr);
      const h = Math.round(cssHeight * dpr);

      // Only update if size changed
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = settings.performance.precision_mode;
        }
      }
    };

    // Initial size
    updateCanvasSize();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [settings.performance.precision_mode]);

  // Clean render function
  const renderCrosshair = useCallback((opts: {
    isActive: boolean;
    pos: {x: number; y: number} | null;
    margins: {left: number; top: number; bottom?: number};
  }) => {
    const { isActive, pos, margins } = opts;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // ✅ CAD-GRADE FIX: Reset transform και clear ΟΛΟΥ του canvas ΠΡΙΝ από οτιδήποτε
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ RESTORE DPR TRANSFORM
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ✅ Early exit ΜΕΤΑ το clear
    if (!isActive || !pos) return;

    // Skip if crosshair disabled
    if (!settings.crosshair?.enabled) return;

    const activeSettings = settings.crosshair;
    const sizePercent = activeSettings.size_percent ?? 50;

    // ✅ CAD-GRADE: Canvas dimensions
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    // ✅ ADR-008: Pixel-perfect alignment - round to nearest pixel + 0.5 for crisp lines
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
  }, [settings, gripSettings]);

  // Track state for optimization
  const prevIsActiveRef = useRef<boolean>(isActive);
  const didRenderOnceRef = useRef<boolean>(false);
  const prevSettingsRef = useRef<string>(JSON.stringify(settings.crosshair));
  const prevMousePosRef = useRef<Point2D | null>(null);

  // RAF-optimized rendering - ✅ ADR-008: Uses internal mousePos instead of prop
  useEffect(() => {
    const hasActiveChanged = prevIsActiveRef.current !== isActive;
    const hasPositionChanged =
      !prevMousePosRef.current !== !mousePos ||
      (prevMousePosRef.current && mousePos &&
       (Math.abs(prevMousePosRef.current.x - mousePos.x) > 0.5 ||
        Math.abs(prevMousePosRef.current.y - mousePos.y) > 0.5));

    const settingsString = JSON.stringify(settings.crosshair);
    const settingsChangedSinceLastFrame = prevSettingsRef.current !== settingsString;
    prevSettingsRef.current = settingsString;

    if (!hasActiveChanged && !settingsChangedSinceLastFrame && !hasPositionChanged) {
      if (didRenderOnceRef.current) {
        return;
      }
    }

    const renderArgs = {
      isActive,
      pos: mousePos, // ✅ ADR-008: Use internal mousePos (canvas-local coordinates)
      margins: rulerMargins
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    if (settings.performance.use_raf) {
      rafRef.current = requestAnimationFrame(() => renderCrosshair(renderArgs));
    } else {
      renderCrosshair(renderArgs);
    }

    didRenderOnceRef.current = true;
    prevIsActiveRef.current = isActive;
    prevMousePosRef.current = mousePos;

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    isActive,
    mousePos, // ✅ ADR-008: Dependency on internal mousePos
    settings.crosshair,
    settings.performance.use_raf,
    renderCrosshair,
    rulerMargins
    // ✅ ADR-008: REMOVED validViewport deps - canvas size now from ResizeObserver
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ ...style, zIndex: portalComponents.overlay.crosshair.zIndex() }}
    />
  );
}
