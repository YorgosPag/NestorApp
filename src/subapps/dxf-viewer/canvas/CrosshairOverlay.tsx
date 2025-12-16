
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getCursorSettings, subscribeToCursorSettings, type CursorSettings } from '../systems/cursor/config';
import { useGripContext } from '../providers/GripProvider';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import type { ViewTransform, Point2D } from '../systems/rulers-grid/config';
import type { Viewport } from '../types/scene';
import { canvasUtilities, portalComponents } from '@/styles/design-tokens';

interface CrosshairOverlayProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: Point2D | null;
  mouseWorld?: Point2D | null;  // 🎯 ChatGPT-5 fix - για world coordinates
  viewport?: Viewport;
  transform?: ViewTransform;
}

export default function CrosshairOverlay({
  className = '',
  isActive = true,
  cursorPosition = null,
  mouseWorld = null,  // 🎯 ChatGPT-5 fix
  viewport = { width: 0, height: 0 },
  transform
}: CrosshairOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<CursorSettings>(getCursorSettings());
  const rafRef = useRef<number>();

  // ✅ Track previous position to avoid unnecessary renders
  const prevPositionRef = useRef<Point2D | null>(null);

  // === GRIP SETTINGS INTEGRATION ===
  const { gripSettings } = useGripContext();

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings(setSettings);
    return unsubscribe;
  }, []);

  // 🎯 ChatGPT-5 FIX: Εξασφάλιση ότι το viewport είναι πάντα valid
  const validViewport = {
    width: viewport?.width || 1920,
    height: viewport?.height || 1080
  };

  // 🎯 ChatGPT-5 FIX: Άμεση διόρθωση Canvas Size Mismatch
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

    console.log('🎯 [CrosshairOverlay] Canvas size fixed:', {
      CSS: `${validViewport.width}×${validViewport.height}`,
      backing: `${w}×${h}`,
      dpr
    });
  }, [validViewport.width, validViewport.height, settings.performance.precision_mode]);

  // 🎯 ChatGPT-5 FIX: Καθαρή συνάρτηση χωρίς closures για αποφυγή stale state
  const renderCrosshair = useCallback((opts: {
    isActive: boolean;
    pos: {x: number; y: number} | null;
    vp: {width: number; height: number};
  }) => {
    const { isActive, pos, vp } = opts;
    console.log('🎯 [CrosshairOverlay] renderCrosshair called with:', opts);

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ [CrosshairOverlay] No canvas');
      return;
    }

    console.log('🎯 [CrosshairOverlay] Canvas dimensions:', {
      width: canvas.width,
      height: canvas.height,
      style: {
        width: canvas.style.width,
        height: canvas.style.height
      },
      viewport: vp
    });

    if (!isActive) {
      console.log('❌ [CrosshairOverlay] Not active');
      return;
    }

    if (!pos) {
      console.log('❌ [CrosshairOverlay] No cursor position');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ [CrosshairOverlay] No context');
      return;
    }

    // 🎯 SAFEGUARD: Καθαρό redraw με ctx.save/restore
    ctx.save(); // Αποθήκευση canvas state

    // Clear full canvas με vp από ορίσματα
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('🧹 [CrosshairOverlay] Canvas cleared');

    // Skip rendering if crosshair disabled
    if (!settings.crosshair?.enabled) {
      console.log('❌ [CrosshairOverlay] Crosshair disabled in settings');
      ctx.restore(); // Επαναφορά canvas state
      return;
    }

    console.log('✅ [CrosshairOverlay] Starting crosshair render');
    console.log('🔧 [CrosshairOverlay] settings.crosshair:', settings.crosshair);

    // Use actual settings from the store
    const activeSettings = settings.crosshair;

    // Calculate effective size with fallback
    const sizePercent = activeSettings.size_percent ?? 50;

    const { x: rawMouseX, y: rawMouseY } = pos;
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
    const fullWidth = vp.width;
    const fullHeight = vp.height;
    const crosshairHalfWidth = (fullWidth / 2) * (settings.crosshair.size_percent / 100);
    const crosshairHalfHeight = (fullHeight / 2) * (settings.crosshair.size_percent / 100);
    
    // === CENTER GAP CALCULATION ===
    // 🎯 SAFEGUARD: Gap clamped στο 0-10% του viewport
    const maxGapPercent = Math.min(validViewport.width, validViewport.height) * 0.10; // 10% max
    const pickboxSize = gripSettings.pickBoxSize * dpr;
    let centerGap = 0;

    if (!settings.cursor?.enabled) {
      // Κέρσορας απενεργός = γραμμές ενώνονται στο κέντρο (gap = 0%)
      centerGap = 0;
    } else if (settings.crosshair.use_cursor_gap) {
      // Χρήση cursor size για gap - clamp σε 0-10%
      const cursorRadius = (settings.cursor.size || 10) / 2;
      const proposedGap = cursorRadius + 2;
      centerGap = Math.min(proposedGap, maxGapPercent);
    } else {
      // Κλασική λειτουργία - clamp σε 0-10%
      const proposedGap = Math.max(pickboxSize + 4, settings.crosshair.center_gap_px || 0);
      centerGap = Math.min(proposedGap, maxGapPercent);
    }
      
    // Setup drawing style
    console.log('🎨 [CrosshairOverlay] Applying styles:', {
      color: activeSettings.color,
      lineWidth: activeSettings.line_width,
      opacity: activeSettings.opacity || 1.0,
      centerGap,
      crosshairHalfWidth,
      crosshairHalfHeight
    });

    ctx.strokeStyle = activeSettings.color;
    ctx.lineWidth = activeSettings.line_width;
    ctx.lineCap = 'square';
    ctx.globalAlpha = activeSettings.opacity || 1.0;

    console.log('🎨 [CrosshairOverlay] Context state after applying:', {
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      globalAlpha: ctx.globalAlpha,
      lineCap: ctx.lineCap
    });
    
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
        crosshairHalfWidth = Math.max(mouseX, vp.width - mouseX);
        crosshairHalfHeight = Math.max(mouseY, vp.height - mouseY);
      } else {
        // Normal percentage mode
        crosshairHalfWidth = (vp.width / 2) * (sizePercent / 100);
        crosshairHalfHeight = (vp.height / 2) * (sizePercent / 100);
      }
      

      // Draw horizontal crosshair lines (with gap for pickbox)
      ctx.beginPath();
      // Left side - από mouseX-crosshairHalfWidth έως centerGap
      const leftStart = Math.max(0, mouseX - crosshairHalfWidth);
      const leftEnd = mouseX - centerGap;
      console.log('🔹 [CrosshairOverlay] Horizontal Left:', { leftStart, leftEnd, mouseX, mouseY, centerGap });
      if (leftEnd > leftStart) {
        ctx.moveTo(leftStart, mouseY);
        ctx.lineTo(leftEnd, mouseY);
        console.log('✏️ [CrosshairOverlay] Drawing left horizontal line');
      }

      // Right side - από centerGap έως mouseX+crosshairHalfWidth
      const rightStart = mouseX + centerGap;
      const rightEnd = Math.min(vp.width, mouseX + crosshairHalfWidth);
      console.log('🔹 [CrosshairOverlay] Horizontal Right:', { rightStart, rightEnd, mouseX });
      if (rightStart < rightEnd) {
        ctx.moveTo(rightStart, mouseY);
        ctx.lineTo(rightEnd, mouseY);
        console.log('✏️ [CrosshairOverlay] Drawing right horizontal line');
      }
      ctx.stroke();
      console.log('🎨 [CrosshairOverlay] Horizontal lines stroked');

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
      const bottomEnd = Math.min(vp.height, mouseY + crosshairHalfHeight);
      if (bottomStart < bottomEnd) {
        ctx.moveTo(mouseX, bottomStart);
        ctx.lineTo(mouseX, bottomEnd);
      }
      ctx.stroke();
      console.log('✅ [CrosshairOverlay] Crosshair lines drawn successfully');
    }

    // === CURSOR RENDERING (από Cursor Settings) ===
    if (settings.cursor?.enabled) {

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
        // Circle cursor
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, cursorHalfSize, 0, Math.PI * 2);
        ctx.stroke();
      } else {
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

    // 🎯 SAFEGUARD: Επαναφορά canvas state
    ctx.restore();

    console.log('🎯 [CrosshairOverlay] Render completed successfully');
  }, [settings, gripSettings]); // Μόνο dependencies που δεν αλλάζουν με args

  // Track previous isActive state και did-render flag
  const prevIsActiveRef = useRef<boolean>(isActive);
  const didRenderOnceRef = useRef<boolean>(false);
  const prevSettingsRef = useRef<string>(JSON.stringify(settings.crosshair));

  // RAF-optimized rendering με position comparison
  useEffect(() => {
    console.log('🎯 [CrosshairOverlay] useEffect triggered - isActive:', isActive, 'cursorPosition:', cursorPosition);

    // ✅ Check if isActive changed (tool switch)
    const hasActiveChanged = prevIsActiveRef.current !== isActive;

    // ✅ Check if position actually changed
    const hasPositionChanged =
      !prevPositionRef.current !== !cursorPosition ||
      (prevPositionRef.current && cursorPosition &&
       (Math.abs(prevPositionRef.current.x - cursorPosition.x) > 0.5 ||
        Math.abs(prevPositionRef.current.y - cursorPosition.y) > 0.5));

    // ✅ Check if settings changed (για Floating Panel integration)
    const settingsString = JSON.stringify(settings.crosshair);
    const settingsChangedSinceLastFrame = prevSettingsRef.current !== settingsString;
    prevSettingsRef.current = settingsString;

    // 👉 ΠΟΤΕ skip όταν αλλάζει εργαλείο ή ρυθμίσεις - ChatGPT-5 Logic
    if (!hasActiveChanged && !settingsChangedSinceLastFrame && !hasPositionChanged) {
      if (didRenderOnceRef.current) {
        console.log('🎯 [CrosshairOverlay] Skipping render - position unchanged');
        return;
      }
    }

    if (hasActiveChanged) {
      console.log('🎯 [CrosshairOverlay] Force render - isActive changed from', prevIsActiveRef.current, 'to', isActive);
    }

    if (settingsChangedSinceLastFrame) {
      console.log('🎯 [CrosshairOverlay] Force render - crosshair settings changed');
    }

    // 🎯 ChatGPT-5 FIX: Κλήση renderCrosshair με ρητά ορίσματα για αποφυγή stale state
    console.log('🎯 [CrosshairOverlay] Calling renderCrosshair() με ρητά ορίσματα');

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

    // ενημέρωση refs - ChatGPT-5 style
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
    mouseWorld,              // εξαναγκάζει redraw όταν αλλάζει world θέση
    settings.crosshair,      // να πιάνει αλλαγές από Floating Panel
    settings.performance.use_raf,
    validViewport.width,     // για το renderArgs
    validViewport.height,
    renderCrosshair
  ]);

  // Canvas πάντα visible - οι ρυθμίσεις επηρεάζουν το πώς ζωγραφίζει, όχι αν εμφανίζεται
  const displayStatus = 'block';
  console.log('🚨 [CrosshairOverlay] Canvas display status:', {
    'settings.crosshair.enabled': settings.crosshair.enabled,
    'isActive': isActive,
    'display': displayStatus,
    'settings.crosshair': settings.crosshair
  });

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{
        ...canvasUtilities.overlays.crosshair.container,
        display: displayStatus
      }}
      data-debug={`enabled:${settings.crosshair.enabled} active:${isActive} position:${cursorPosition ? `${cursorPosition.x},${cursorPosition.y}` : 'null'}`}
    />
  );
}
