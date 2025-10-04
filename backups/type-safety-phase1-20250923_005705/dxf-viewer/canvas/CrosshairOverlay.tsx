
'use client';

// ✅ Debug flag for crosshair overlay logging
const DEBUG_CANVAS_CORE = false;

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../systems/cursor/config';
import { useGripContext } from '../providers/GripProvider';
import { useCanvasSetup } from './hooks/useCanvasSetup';

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: { x: number; y: number } | null;
  viewport?: { width: number; height: number };
  transform?: any;
}

export default function CrosshairOverlay({
  className = '',
  isActive = true,
  cursorPosition = null,
  viewport = { width: 0, height: 0 },
  transform
}: CrosshairOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());
  const rafRef = useRef<number>();

  // ✅ Track previous position to avoid unnecessary renders
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);

  // === GRIP SETTINGS INTEGRATION === DISABLED FOR TESTING
  // const { gripSettings } = useGripContext();
  const gripSettings = { pickBoxSize: 0, showAperture: false, apertureSize: 0 }; // FORCE DISABLE GRIPS

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  // Setup canvas using shared hook
  useCanvasSetup(canvasRef, {
    viewport,
    imageSmoothingEnabled: settings.performance.precision_mode
  });

  // Render perfect AutoCAD-style crosshair με grip pickbox & aperture
  const renderCrosshair = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear full canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Temporary bypass για testing - render cursor ακόμα κι αν δεν είναι active
    if (!settings.crosshair.enabled) {
      // ✅ Removed verbose logging for performance
      return;
    }
    
    // Αν δεν υπάρχει cursor position, χρησιμοποίησε center του viewport για testing
    let testCursorPosition = cursorPosition;
    if (!cursorPosition || !isActive) {
      testCursorPosition = { x: viewport.width / 2, y: viewport.height / 2 };
      // ✅ Removed verbose logging for performance
    }
    
    // Calculate effective size with fallback
    const sizePercent = settings.crosshair.size_percent ?? 8;
    
    // ✅ Removed verbose crosshair logging for performance

    const { x: rawMouseX, y: rawMouseY } = testCursorPosition;
    const dpr = window.devicePixelRatio || 1;
    
    // Λειτουργία ακρίβειας: sub-pixel positioning
    let mouseX, mouseY;
    if (settings.performance.precision_mode) {
      // High precision: no rounding για pixel-perfect positioning
      mouseX = rawMouseX;
      mouseY = rawMouseY;
    } else {
      // Normal precision: round to nearest pixel
      mouseX = Math.round(rawMouseX);
      mouseY = Math.round(rawMouseY);
    }
    
    // AutoCAD crosshair settings - για full screen crosshair
    // Στο 100% το σταυρόνημα πρέπει να φτάνει από 0 μέχρι width/height
    // Υπολογισμός για να φτάνει πάντα στα άκρα
    const fullWidth = viewport.width;
    const fullHeight = viewport.height;
    const crosshairHalfWidth = (fullWidth / 2) * (settings.crosshair.size_percent / 100);
    const crosshairHalfHeight = (fullHeight / 2) * (settings.crosshair.size_percent / 100);
    
    // === CENTER GAP CALCULATION ===
    const pickboxSize = gripSettings.pickBoxSize * dpr;
    let centerGap = 0;
    
    if (!settings.cursor?.enabled) {
      // Κέρσορας απενεργός = γραμμές ενώνονται στο κέντρο
      centerGap = 0;
    } else if (settings.crosshair.use_cursor_gap) {
      // Χρήση cursor size για gap - οι γραμμές ξεκινάνε έξω από τον κέρσορα
      const cursorRadius = (settings.cursor.size || 10) / 2;
      centerGap = cursorRadius + 2; // μικρό επιπλέον gap
    } else {
      // Κλασική λειτουργία - χρήση pickbox size
      centerGap = Math.max(pickboxSize + 4, settings.crosshair.center_gap_px);
    }
      
    // ✅ Removed verbose center gap logging for performance

    // Setup drawing style
    ctx.strokeStyle = settings.crosshair.color;
    ctx.lineWidth = settings.crosshair.line_width;
    ctx.lineCap = 'square';
    ctx.globalAlpha = settings.crosshair.opacity || 0.9;
    
    // Apply line style (dashed, dotted, etc.)
    const lineStyle = settings.crosshair.line_style || 'solid';
    // Calculate dash patterns based on line width for better visibility
    const lineWidth = settings.crosshair.line_width;
    switch (lineStyle) {
      case 'dashed':
        ctx.setLineDash([lineWidth * 6, lineWidth * 6]);
        break;
      case 'dotted':
        ctx.setLineDash([lineWidth, lineWidth * 8]);
        break;
      case 'dash-dot':
        ctx.setLineDash([lineWidth * 8, lineWidth * 4, lineWidth * 2, lineWidth * 8]);
        break;
      case 'solid':
      default:
        ctx.setLineDash([]);
        break;
    }
    
    // Λειτουργία ακρίβειας: βελτίωση rendering
    if (settings.performance.precision_mode) {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 10;
    }

    // Only draw crosshair lines if size_percent > 0
    if (sizePercent > 0) {
      // Calculate crosshair extent based on size_percent
      let crosshairHalfWidth, crosshairHalfHeight;
      
      if (sizePercent === 100) {
        // Full-screen mode: crosshair extends to viewport edges from cursor position
        crosshairHalfWidth = Math.max(mouseX, viewport.width - mouseX);
        crosshairHalfHeight = Math.max(mouseY, viewport.height - mouseY);
      } else {
        // Normal percentage mode
        crosshairHalfWidth = (viewport.width / 2) * (sizePercent / 100);
        crosshairHalfHeight = (viewport.height / 2) * (sizePercent / 100);
      }
      
      // Draw horizontal crosshair lines (with gap for pickbox)
      ctx.beginPath();
      // Left side - από mouseX-crosshairHalfWidth έως centerGap
      const leftStart = Math.max(0, mouseX - crosshairHalfWidth);
      const leftEnd = mouseX - centerGap;
      if (leftEnd > leftStart) {
        ctx.moveTo(leftStart, mouseY);
        ctx.lineTo(leftEnd, mouseY);
      }
      
      // Right side - από centerGap έως mouseX+crosshairHalfWidth
      const rightStart = mouseX + centerGap;
      const rightEnd = Math.min(viewport.width, mouseX + crosshairHalfWidth);
      if (rightStart < rightEnd) {
        ctx.moveTo(rightStart, mouseY);
        ctx.lineTo(rightEnd, mouseY);
      }
      ctx.stroke();

      // Draw vertical crosshair lines (with gap for pickbox)
      ctx.beginPath();
      // Top side - από mouseY-crosshairHalfHeight έως centerGap
      const topStart = Math.max(0, mouseY - crosshairHalfHeight);
      const topEnd = mouseY - centerGap;
      if (topEnd > topStart) {
        ctx.moveTo(mouseX, topStart);
        ctx.lineTo(mouseX, topEnd);
      }
      
      // Bottom side - από centerGap έως mouseY+crosshairHalfHeight
      const bottomStart = mouseY + centerGap;
      const bottomEnd = Math.min(viewport.height, mouseY + crosshairHalfHeight);
      if (bottomStart < bottomEnd) {
        ctx.moveTo(mouseX, bottomStart);
        ctx.lineTo(mouseX, bottomEnd);
      }
      ctx.stroke();
    }

    // === CURSOR RENDERING (από Cursor Settings) ===
    if (settings.cursor?.enabled) {
      // ✅ Removed verbose logging for performance

      ctx.strokeStyle = settings.cursor.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = settings.cursor.opacity;
      
      // Apply cursor line style
      switch (settings.cursor.line_style) {
        case 'dashed':
          ctx.setLineDash([4, 4]);
          break;
        case 'solid':
        default:
          ctx.setLineDash([]);
          break;
      }
      
      const cursorHalfSize = settings.cursor.size / 2;
      
      if (settings.cursor.shape === 'circle') {
        if (DEBUG_CANVAS_CORE) console.log('🔵 Drawing circle cursor');
        // Circle cursor
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, cursorHalfSize, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        if (DEBUG_CANVAS_CORE) console.log('🔳 Drawing square cursor');
        // Square cursor
        if (settings.performance.precision_mode) {
          ctx.strokeRect(
            mouseX - cursorHalfSize, 
            mouseY - cursorHalfSize, 
            settings.cursor.size, 
            settings.cursor.size
          );
        } else {
          ctx.strokeRect(
            Math.round(mouseX - cursorHalfSize) + 0.5, 
            Math.round(mouseY - cursorHalfSize) + 0.5, 
            Math.round(settings.cursor.size), 
            Math.round(settings.cursor.size)
          );
        }
      }
      
      // Reset line dash
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.9;
    }
    
    // === PICKBOX RENDERING (από GripSettings) === DISABLED για testing
    // ctx.strokeStyle = '#ffffff';
    // ctx.lineWidth = 1;
    
    // if (settings.performance.precision_mode) {
    //   // High precision: exact positioning
    //   const halfPickbox = pickboxSize / 2;
    //   ctx.strokeRect(
    //     mouseX - halfPickbox, 
    //     mouseY - halfPickbox, 
    //     pickboxSize, 
    //     pickboxSize
    //   );
    // } else {
    //   // Normal precision: pixel-aligned
    //   const halfPickbox = Math.round(pickboxSize / 2);
    //   ctx.strokeRect(
    //     Math.round(mouseX - halfPickbox) + 0.5, 
    //     Math.round(mouseY - halfPickbox) + 0.5, 
    //     Math.round(pickboxSize), 
    //     Math.round(pickboxSize)
    //   );
    // }

    // === SNAP APERTURE RENDERING === DISABLED για testing
    // if (gripSettings.showAperture) {
    //   ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Κίτρινο aperture
    //   ctx.lineWidth = 1;
    //   ctx.beginPath();
    //   ctx.arc(mouseX, mouseY, gripSettings.apertureSize * dpr, 0, Math.PI * 2);
    //   ctx.stroke();
    // }

    ctx.globalAlpha = 1;
  }, [settings, isActive, cursorPosition, gripSettings, viewport]);

  // RAF-optimized rendering με position comparison
  useEffect(() => {
    // ✅ Check if position actually changed
    const hasPositionChanged =
      !prevPositionRef.current !== !cursorPosition ||
      (prevPositionRef.current && cursorPosition &&
       (Math.abs(prevPositionRef.current.x - cursorPosition.x) > 0.5 ||
        Math.abs(prevPositionRef.current.y - cursorPosition.y) > 0.5));

    if (!hasPositionChanged && prevPositionRef.current !== null) {
      return; // Skip render if position hasn't changed significantly
    }

    // Update previous position
    prevPositionRef.current = cursorPosition;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    if (settings.performance.use_raf) {
      rafRef.current = requestAnimationFrame(renderCrosshair);
    } else {
      renderCrosshair();
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [renderCrosshair, settings.performance.use_raf, cursorPosition]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{
        zIndex: 10,
        display: settings.crosshair.enabled && isActive ? 'block' : 'none'
      }}
      data-debug={`enabled:${settings.crosshair.enabled} active:${isActive} position:${cursorPosition ? `${cursorPosition.x},${cursorPosition.y}` : 'null'}`}
    />
  );
}

export { CrosshairOverlay };
