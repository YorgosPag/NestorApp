'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { Point2D, Viewport } from '../../rendering/types/Types';
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
  const contextTransform = useTransformValue();

  // 🚀 PERF: Single state object → 1 re-render per tick, not 4.
  // Throttled to 100ms (10fps) — sufficient for a debug readout.
  const [displayData, setDisplayData] = useState({
    mouseScreen: { x: 0, y: 0 } as Point2D,
    mouseWorld: { x: 0, y: 0 } as Point2D,
    viewport: { width: 0, height: 0 } as Viewport,
    canvasRect: null as DOMRect | null,
  });

  // Refs: always-fresh data for clipboard copy (never stale)
  const currentValues = useRef({
    mouseScreen: { x: 0, y: 0 } as Point2D,
    mouseWorld: { x: 0, y: 0 } as Point2D,
    canvasRect: null as DOMRect | null,
    transform: contextTransform,
    lastRenderTime: 0,
  });

  useEffect(() => {
    currentValues.current.transform = contextTransform;
  }, [contextTransform]);

  useEffect(() => {
    const THROTTLE_MS = 100; // 10fps for debug display

    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key;
      let copyKey: string | null = null;
      if (key === 'F1') copyKey = 'c';
      else if (key === 'F2') copyKey = 's';
      else if (key === 'F3') copyKey = 'w';
      else if (key === 'F4') copyKey = 't';

      if (copyKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.globalCoordinateCopy?.(copyKey);
        return false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      window.lastMouseEvent = e;
      window.lastMouseUpdate = Date.now();

      const screenPos = { x: e.clientX, y: e.clientY };
      currentValues.current.mouseScreen = screenPos;

      // Throttle React re-renders to 10fps
      const now = performance.now();
      if (now - currentValues.current.lastRenderTime < THROTTLE_MS) return;
      currentValues.current.lastRenderTime = now;

      // getBoundingClientRect only at throttle rate (avoids forced reflow every frame)
      let newRect = currentValues.current.canvasRect;
      let newWorldPos = currentValues.current.mouseWorld;

      const dxfCanvas = document.querySelector('.dxf-canvas') as HTMLCanvasElement;
      if (dxfCanvas) {
        newRect = dxfCanvas.getBoundingClientRect();
        currentValues.current.canvasRect = newRect;
        const canvasPoint = { x: e.clientX - newRect.left, y: e.clientY - newRect.top };
        newWorldPos = CoordinateTransforms.screenToWorld(
          canvasPoint,
          currentValues.current.transform,
          { width: newRect.width, height: newRect.height },
        );
        currentValues.current.mouseWorld = newWorldPos;
      }

      setDisplayData({
        mouseScreen: screenPos,
        mouseWorld: newWorldPos,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        canvasRect: newRect,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress, true);
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress, true);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const { mouseScreen, mouseWorld, canvasRect } = displayData;

  return (
    <div className={cn(styles.debugOverlay, className)}>
      {/* Real-time cursor info */}
      <div className={styles.overlayPositioned}>
        <div className={styles.sectionTitle}>🎯 LIVE COORDINATES</div>

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabel}>Screen:</span>
          <span className={styles.coordinateValue}>X: {Math.round(mouseScreen.x)}, Y: {Math.round(mouseScreen.y)}</span>
        </div>

        {canvasRect && (
          <div className={styles.coordinateGroup}>
            <span className={styles.coordinateLabelCanvas}>Canvas:</span>
            <span className={styles.coordinateValue}>
              X: {Math.round(mouseScreen.x - canvasRect.left)},
              Y: {Math.round(mouseScreen.y - canvasRect.top)}
            </span>
          </div>
        )}

        <div className={styles.coordinateGroup}>
          <span className={styles.coordinateLabelWorld}>World:</span>
          <span className={styles.coordinateValue}>
            X: {mouseWorld.x.toFixed(2)}, Y: {mouseWorld.y.toFixed(2)}
          </span>
        </div>

        <div className={styles.dividerSection}>
          <div className={styles.subsectionTitle}>TRANSFORM</div>
          <div>Scale: {contextTransform.scale.toFixed(3)}</div>
          <div>Offset: ({contextTransform.offsetX.toFixed(1)}, {contextTransform.offsetY.toFixed(1)})</div>
        </div>

        {canvasRect && (
          <div className={styles.dividerSection}>
            <div className={styles.subsectionTitle}>CANVAS BOUNDS</div>
            <div>Size: {Math.round(canvasRect.width)} × {Math.round(canvasRect.height)}</div>
            <div>Position: ({Math.round(canvasRect.left)}, {Math.round(canvasRect.top)})</div>
          </div>
        )}

        <div className={styles.shortcutsSection}>
          <div className={styles.subsectionTitle}>📋 COPY SHORTCUTS</div>
          <div className={styles.shortcutItem}>F1: All data</div>
          <div className={styles.shortcutItem}>F2: Screen coords</div>
          <div className={styles.shortcutItem}>F3: World coords</div>
          <div className={styles.shortcutItem}>F4: Transform</div>
        </div>
      </div>

      {/* Crosshair: updates at throttled rate (10fps) — fine for debug */}
      <div
        className={styles.crosshairContainer}
        style={canvasUtilities.geoInteractive.debugCrosshairPosition(mouseScreen.x, mouseScreen.y)}
      >
        <div className={styles.crosshairHorizontal} />
        <div className={styles.crosshairVertical} />
        <div className={styles.crosshairCenter} />
      </div>
    </div>
  );
}
