'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../../systems/cursor/config';
import { useGripContext } from '../../providers/GripProvider';
import type { Point2D } from '../../rendering/types/Types';
import { portalComponents, interactionUtilities, layoutUtilities } from '@/styles/design-tokens';

interface Viewport {
  width: number;
  height: number;
}

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: Point2D | null;
  mouseWorld?: Point2D | null;
  viewport?: Viewport;
}

export default function CrosshairOverlay({
  className = '',
  isActive = true,
  cursorPosition = null,
  mouseWorld = null,
  viewport = { width: 0, height: 0 },
}: CrosshairOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());
  const rafRef = useRef<number>();

  // Track previous position to avoid unnecessary renders
  const prevPositionRef = useRef<Point2D | null>(null);

  // === GRIP SETTINGS INTEGRATION ===
  const { gripSettings } = useGripContext();

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  // Ensure viewport is always valid
  const validViewport = {
    width: viewport?.width || 1920,
    height: viewport?.height || 1080
  };

  // Canvas Size Fix
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(validViewport.width * dpr);
    const h = Math.round(validViewport.height * dpr);

    // CSS px
    canvas.style.width = `${validViewport.width}px`;
    canvas.style.height = `${validViewport.height}px`;

    // Backing store px
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = settings.performance.precision_mode;
    }
  }, [validViewport.width, validViewport.height, settings.performance.precision_mode]);

  // Clean render function
  const renderCrosshair = useCallback((opts: {
    isActive: boolean;
    pos: {x: number; y: number} | null;
    vp: {width: number; height: number};
  }) => {
    const { isActive, pos, vp } = opts;

    const canvas = canvasRef.current;
    if (!canvas || !isActive || !pos) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Skip if crosshair disabled
    if (!settings.crosshair?.enabled) return;

    const activeSettings = settings.crosshair;
    const sizePercent = activeSettings.size_percent ?? 50;
    const { x: rawMouseX, y: rawMouseY } = pos;
    const dpr = window.devicePixelRatio || 1;

    // Precision mode positioning
    let mouseX, mouseY;
    if (settings.performance.precision_mode) {
      mouseX = rawMouseX;
      mouseY = rawMouseY;
    } else {
      mouseX = Math.round(rawMouseX);
      mouseY = Math.round(rawMouseY);
    }

    // Calculate crosshair dimensions
    const fullWidth = vp.width;
    const fullHeight = vp.height;
    const crosshairHalfWidth = (fullWidth / 2) * (sizePercent / 100);
    const crosshairHalfHeight = (fullHeight / 2) * (sizePercent / 100);

    // Center gap calculation
    const pickboxSize = gripSettings.pickBoxSize * dpr;
    let centerGap = Math.max(pickboxSize + 4, settings.crosshair.center_gap_px || 5);

    // Setup drawing style
    ctx.strokeStyle = activeSettings.color;
    ctx.lineWidth = activeSettings.line_width;
    ctx.lineCap = 'square';
    ctx.globalAlpha = activeSettings.opacity || 1.0;

    // Only draw if size > 0
    if (sizePercent > 0) {
      let actualHalfWidth, actualHalfHeight;

      if (sizePercent === 100) {
        // Full-screen mode
        actualHalfWidth = Math.max(mouseX, vp.width - mouseX);
        actualHalfHeight = Math.max(mouseY, vp.height - mouseY);
      } else {
        actualHalfWidth = crosshairHalfWidth;
        actualHalfHeight = crosshairHalfHeight;
      }

      // Draw horizontal lines
      ctx.beginPath();
      const leftStart = Math.max(0, mouseX - actualHalfWidth);
      const leftEnd = mouseX - centerGap;
      if (leftEnd > leftStart) {
        ctx.moveTo(leftStart, mouseY);
        ctx.lineTo(leftEnd, mouseY);
      }

      const rightStart = mouseX + centerGap;
      const rightEnd = Math.min(vp.width, mouseX + actualHalfWidth);
      if (rightStart < rightEnd) {
        ctx.moveTo(rightStart, mouseY);
        ctx.lineTo(rightEnd, mouseY);
      }
      ctx.stroke();

      // Draw vertical lines
      ctx.beginPath();
      const topStart = Math.max(0, mouseY - actualHalfHeight);
      const topEnd = mouseY - centerGap;
      if (topEnd > topStart) {
        ctx.moveTo(mouseX, topStart);
        ctx.lineTo(mouseX, topEnd);
      }

      const bottomStart = mouseY + centerGap;
      const bottomEnd = Math.min(vp.height, mouseY + actualHalfHeight);
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

  // RAF-optimized rendering
  useEffect(() => {
    const hasActiveChanged = prevIsActiveRef.current !== isActive;
    const hasPositionChanged =
      !prevPositionRef.current !== !cursorPosition ||
      (prevPositionRef.current && cursorPosition &&
       (Math.abs(prevPositionRef.current.x - cursorPosition.x) > 0.5 ||
        Math.abs(prevPositionRef.current.y - cursorPosition.y) > 0.5));

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
      pos: cursorPosition,
      vp: validViewport
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
    prevPositionRef.current = cursorPosition || null;

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    isActive,
    cursorPosition,
    mouseWorld,
    settings.crosshair,
    settings.performance.use_raf,
    validViewport.width,
    validViewport.height,
    renderCrosshair
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className}`}
      style={portalComponents.overlay.fullscreen}
    />
  );
}