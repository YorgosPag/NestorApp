'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useTransformValue } from '../../contexts/TransformContext';
// Enterprise CSS Module - CLAUDE.md Protocol N.3 compliance
import styles from './DebugOverlay.module.css';
import { cn } from '@/lib/utils';
import { canvasUtilities } from '@/styles/design-tokens';
import { generateTempId } from '@/services/enterprise-id.service';

// Global window extension
declare global {
  interface Window {
    globalCoordinateCopy?: (key: string) => void;
    lastMouseEvent?: MouseEvent;
    lastMouseUpdate?: number;
  }
}

interface CoordinateDebugOverlayProps {
  className?: string;
}

// ⚡ GLOBAL COPY FUNCTION - Εντελώς εκτός React
// 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
if (!window.globalCoordinateCopy) {
  window.globalCoordinateCopy = (key: string) => {
    const now = Date.now();
    const uniqueId = generateTempId().substring(0, 8); // Short ID for logging

    // Get fresh mouse position
    const mouseEvent = window.lastMouseEvent;
    if (!mouseEvent) {
      return;
    }

    const screenX = mouseEvent.clientX;
    const screenY = mouseEvent.clientY;

    // Calculate canvas coordinates
    const canvas = document.querySelector('.dxf-canvas') as HTMLCanvasElement;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX = Math.round(screenX - rect.left);
    const canvasY = Math.round(screenY - rect.top);

    // ✅ GET TRANSFORM: Use window.dxfTransform (updated by Context)
    const transform = window.dxfTransform || { scale: 1, offsetX: 0, offsetY: 0 };

    // ✅ VIEWPORT: Use CANVAS viewport (EXACTLY as live panel component - line 217!)
    const canvasViewport = { width: rect.width, height: rect.height };

    // ✅ WORLD COORDINATES: Use CoordinateTransforms.screenToWorld (EXACTLY as live panel - line 218!)
    const canvasPoint = { x: canvasX, y: canvasY };
    const worldPos = CoordinateTransforms.screenToWorld(canvasPoint, transform, canvasViewport);
    const worldX = worldPos.x;
    const worldY = worldPos.y;

    // Build copy text
    let text = '';
    switch (key) {
      case 'c':
        text = `Screen: (${screenX}, ${screenY}) | Canvas: (${canvasX}, ${canvasY}) | World: (${worldX.toFixed(2)}, ${worldY.toFixed(2)}) | Transform: Scale=${transform.scale.toFixed(3)}, Offset=(${transform.offsetX.toFixed(1)}, ${transform.offsetY.toFixed(1)}) | [${uniqueId}@${now}]`;
        break;
      case 's':
        text = `Screen: (${screenX}, ${screenY}) [${uniqueId}@${now}]`;
        break;
      case 'w':
        text = `World: (${worldX.toFixed(2)}, ${worldY.toFixed(2)}) [${uniqueId}@${now}]`;
        break;
      case 't':
        text = `Transform: Scale=${transform.scale.toFixed(3)}, Offset=(${transform.offsetX.toFixed(1)}, ${transform.offsetY.toFixed(1)}) | [${uniqueId}@${now}]`;
        break;
    }

    if (text) {
      // ✅ DUAL OUTPUT: Και clipboard ΚΑΙ modal για verification

      // 1. Copy to clipboard με force clear πρώτα
      try {
        // Clear clipboard πρώτα
        const clearArea = document.createElement('textarea');
        clearArea.value = '';
        clearArea.style.position = 'fixed';
        clearArea.style.opacity = '0';
        document.body.appendChild(clearArea);
        clearArea.select();
        document.execCommand('copy');
        document.body.removeChild(clearArea);

        // Τώρα copy την πραγματική τιμή
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        // Silent clipboard failure
      }
    }
  };
}

export default function CoordinateDebugOverlay({ className = '' }: CoordinateDebugOverlayProps) {
  // ✅ ENTERPRISE ARCHITECTURE: Use Context for transform (Single Source of Truth)
  const contextTransform = useTransformValue();

  const [mouseScreen, setMouseScreen] = useState<Point2D>({ x: 0, y: 0 });
  const [mouseWorld, setMouseWorld] = useState<Point2D>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

  // ✅ FIX: Χρήση useRef για current values που δεν προκαλούν re-renders
  const currentValues = useRef({
    mouseScreen: { x: 0, y: 0 },
    mouseWorld: { x: 0, y: 0 },
    canvasRect: null as DOMRect | null,
    transform: contextTransform // ✅ ENTERPRISE: Use Context transform
  });

  // ✅ SYNC: Update ref when context transform changes
  useEffect(() => {
    currentValues.current.transform = contextTransform;
  }, [contextTransform]);

  // ✅ PURE EXTERNAL LOGIC - Στο window πριν από το React
  useEffect(() => {

    // ✅ ENHANCED GLOBAL MOUSE TRACKING
    const enhancedMouseMove = (e: MouseEvent) => {
      // Αποθηκεύω το event με timestamp
      window.lastMouseEvent = e;
      window.lastMouseUpdate = Date.now();
    };

    // ⚡ SIMPLE HANDLER - Καλεί την εξωτερική global function
    const handleKeyPress = (e: KeyboardEvent) => {
      // 🔥 SIMPLE F-KEY SHORTCUTS - Δεν συγκρούονται με browser
      const key = e.key;
      let copyKey = null;

      if (key === 'F1') copyKey = 'c'; // F1 = All data
      else if (key === 'F2') copyKey = 's'; // F2 = Screen coords
      else if (key === 'F3') copyKey = 'w'; // F3 = World coords
      else if (key === 'F4') copyKey = 't'; // F4 = Transform

      if (copyKey) {
        // 🔥 AGGRESSIVE PREVENTION: Σταματάω ΑΜΕΣΑ το event
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Καλώ την copy function
        window.globalCoordinateCopy?.(copyKey);

        return false;
      }
    };

    // Legacy handleMouseMove για UI state
    const handleMouseMove = (e: MouseEvent) => {
      enhancedMouseMove(e); // Global tracking πρώτα

      const screenPos = { x: e.clientX, y: e.clientY };

      // ✅ FIXED: Ενημέρωση currentValues για immediate access
      currentValues.current.mouseScreen = screenPos;

      // Update screen coordinates για UI
      setMouseScreen(screenPos);

      // Update viewport
      setViewport({ width: window.innerWidth, height: window.innerHeight });

      // Try to get canvas bounds
      const dxfCanvas = document.querySelector('.dxf-canvas') as HTMLCanvasElement;
      if (dxfCanvas) {
        const rect = dxfCanvas.getBoundingClientRect();
        currentValues.current.canvasRect = rect;
        setCanvasRect(rect);

        // Calculate relative to canvas
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // ✅ FIXED: Χρήση διορθωμένου CoordinateTransforms με current transform
        const canvasPoint = { x: canvasX, y: canvasY };
        const canvasViewport = { width: rect.width, height: rect.height };
        const worldPos = CoordinateTransforms.screenToWorld(canvasPoint, currentValues.current.transform, canvasViewport);

        // Ενημέρωση και currentValues και state
        currentValues.current.mouseWorld = worldPos;
        setMouseWorld(worldPos);
      }
    };

    // ✅ ENTERPRISE: No need for updateTransform - Context handles this!
    // Transform updates are automatic via useTransformValue() hook

    window.addEventListener('mousemove', handleMouseMove);
    // 🔥 AGGRESSIVE EVENT CAPTURE: Capture στην capture phase για να πιάσουμε πρώτα το event
    document.addEventListener('keydown', handleKeyPress, true); // true = capture phase
    window.addEventListener('keydown', handleKeyPress); // backup στο bubbling phase

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress, true); // cleanup capture phase
      window.removeEventListener('keydown', handleKeyPress); // cleanup bubbling phase
    };
  }, []); // ✅ FIXED: Κενό dependency array - το event listener δημιουργείται μόνο μία φορά

  return (
    <div className={cn(styles.debugOverlay, className)}>
      {/* Real-time cursor info - κάτω αριστερή γωνία (bottom: 0, left: 6) */}
      <div className={styles.overlayPositioned}>
        <div className={styles.sectionTitle}>🎯 LIVE COORDINATES</div>

        {/* Screen Coordinates */}
        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabel}>Screen:</span>
          <span className={styles.coordinateValue}>X: {Math.round(mouseScreen.x)}, Y: {Math.round(mouseScreen.y)}</span>
        </div>

        {/* Canvas Relative */}
        {canvasRect && (
          <div className={styles.coordinateGroup}>
            <span className={styles.coordinateLabelCanvas}>Canvas:</span>
            <span className={styles.coordinateValue}>
              X: {Math.round(mouseScreen.x - canvasRect.left)},
              Y: {Math.round(mouseScreen.y - canvasRect.top)}
            </span>
          </div>
        )}

        {/* World Coordinates */}
        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabelWorld}>World:</span>
          <span className={styles.coordinateValue}>
            X: {mouseWorld.x.toFixed(2)}, Y: {mouseWorld.y.toFixed(2)}
          </span>
        </div>

        {/* Transform Info */}
        <div className={styles.dividerSection}>
          <div className={styles.subsectionTitle}>TRANSFORM</div>
          <div>Scale: {contextTransform.scale.toFixed(3)}</div>
          <div>Offset: ({contextTransform.offsetX.toFixed(1)}, {contextTransform.offsetY.toFixed(1)})</div>
        </div>

        {/* Canvas Info */}
        {canvasRect && (
          <div className={styles.dividerSection}>
            <div className={styles.subsectionTitle}>CANVAS BOUNDS</div>
            <div>Size: {Math.round(canvasRect.width)} × {Math.round(canvasRect.height)}</div>
            <div>Position: ({Math.round(canvasRect.left)}, {Math.round(canvasRect.top)})</div>
          </div>
        )}

        {/* Copy Shortcuts */}
        <div className={styles.shortcutsSection}>
          <div className={styles.subsectionTitle}>📋 COPY SHORTCUTS</div>
          <div className={styles.shortcutItem}>F1: All data</div>
          <div className={styles.shortcutItem}>F2: Screen coords</div>
          <div className={styles.shortcutItem}>F3: World coords</div>
          <div className={styles.shortcutItem}>F4: Transform</div>
        </div>
      </div>

      {/* Crosshair cursor indicator */}
      <div
        className={styles.crosshairContainer}
        style={canvasUtilities.geoInteractive.debugCrosshairPosition(mouseScreen.x, mouseScreen.y)}
      >
        {/* Horizontal line */}
        <div className={styles.crosshairHorizontal} />
        {/* Vertical line */}
        <div className={styles.crosshairVertical} />
        {/* Center dot */}
        <div className={styles.crosshairCenter} />
      </div>
    </div>
  );
}
