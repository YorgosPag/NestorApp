/**
 * =============================================================================
 * ENTERPRISE: Centralized Zoom + Pan Hook
 * =============================================================================
 *
 * Provides mouse wheel zoom, mouse drag pan, touch pinch-to-zoom, and touch pan
 * for any zoomable/pannable container (images, canvases, floorplans, etc.).
 *
 * @module hooks/useZoomPan
 * @enterprise ADR-187 — Floorplan Viewer Enhancements
 *
 * Features:
 * - Mouse wheel zoom (smooth, non-passive for scroll prevention)
 * - Mouse drag to pan (left-click + drag when zoomed > 1)
 * - Pinch-to-zoom (mobile 2-finger gesture)
 * - Touch pan (mobile 1-finger when zoomed > 1)
 * - Button controls (zoomIn, zoomOut, resetAll)
 * - Configurable limits (minZoom, maxZoom, zoomStep)
 * - Cursor hints (grab/grabbing during pan)
 *
 * Used by:
 * - FloorplanGallery (inline + fullscreen modal)
 *
 * @example
 * ```tsx
 * const zp = useZoomPan({ minZoom: 0.5, maxZoom: 8 });
 *
 * <figure ref={zp.containerRef} {...zp.handlers} className={zp.cursorClass}>
 *   <img src={url} style={zp.contentStyle} />
 * </figure>
 * ```
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, TouchEvent } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ZoomPanConfig {
  /** Minimum zoom level (default: 0.25) */
  minZoom?: number;
  /** Maximum zoom level (default: 4) */
  maxZoom?: number;
  /** Zoom step for button controls (default: 0.25) */
  zoomStep?: number;
  /** Default/initial zoom level (default: 1) */
  defaultZoom?: number;
  /** Wheel zoom sensitivity — higher = faster (default: 0.001) */
  wheelSensitivity?: number;
}

export interface PanOffset {
  readonly x: number;
  readonly y: number;
}

interface ZoomPanHandlers {
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

export interface UseZoomPanReturn {
  /** Current zoom level */
  zoom: number;
  /** Current pan offset in pixels */
  panOffset: PanOffset;
  /** Whether user is currently dragging to pan */
  isPanning: boolean;
  /** Zoom in by one step */
  zoomIn: () => void;
  /** Zoom out by one step */
  zoomOut: () => void;
  /** Reset zoom and pan to defaults */
  resetAll: () => void;
  /** Callback ref — attach to the zoomable container element */
  containerRef: (node: HTMLElement | null) => void;
  /** Mouse/touch event handlers to spread on the container */
  handlers: ZoomPanHandlers;
  /** CSS transform style for image/content element (translate + scale) */
  contentStyle: CSSProperties;
  /** Tailwind cursor class based on zoom/pan state */
  cursorClass: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULTS = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
  defaultZoom: 1,
  wheelSensitivity: 0.001,
} as const;

const ZERO_OFFSET: PanOffset = { x: 0, y: 0 };

// ============================================================================
// UTILITIES
// ============================================================================

/** Euclidean distance between two touch points */
function touchDistance(t1: React.Touch, t2: React.Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// HOOK
// ============================================================================

export function useZoomPan(config: ZoomPanConfig = {}): UseZoomPanReturn {
  const {
    minZoom = DEFAULTS.minZoom,
    maxZoom = DEFAULTS.maxZoom,
    zoomStep = DEFAULTS.zoomStep,
    defaultZoom = DEFAULTS.defaultZoom,
    wheelSensitivity = DEFAULTS.wheelSensitivity,
  } = config;

  // ---- State ----
  const [zoom, setZoomRaw] = useState(defaultZoom);
  const [panOffset, setPanOffset] = useState<PanOffset>(ZERO_OFFSET);
  const [isPanning, setIsPanning] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);

  // ---- Refs (avoid stale closures in stable callbacks) ----
  const zoomRef = useRef(defaultZoom);
  const panRef = useRef<PanOffset>(ZERO_OFFSET);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<PanOffset>(ZERO_OFFSET);
  const initialPanRef = useRef<PanOffset>(ZERO_OFFSET);
  const pinchDistRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(defaultZoom);

  // Keep refs in sync with state
  zoomRef.current = zoom;
  panRef.current = panOffset;
  isPanningRef.current = isPanning;

  // ---- Clamp helper ----
  const clampZoom = useCallback(
    (value: number): number => Math.min(maxZoom, Math.max(minZoom, value)),
    [minZoom, maxZoom],
  );

  // ---- Callback ref for container element ----
  const containerRef = useCallback((node: HTMLElement | null) => {
    setContainerEl(node);
  }, []);

  // =========================================================================
  // BUTTON CONTROLS
  // =========================================================================

  const zoomIn = useCallback(() => {
    setZoomRaw(prev => clampZoom(prev + zoomStep));
  }, [clampZoom, zoomStep]);

  const zoomOut = useCallback(() => {
    setZoomRaw(prev => {
      const next = clampZoom(prev - zoomStep);
      if (next <= 1) setPanOffset(ZERO_OFFSET);
      return next;
    });
  }, [clampZoom, zoomStep]);

  const resetAll = useCallback(() => {
    setZoomRaw(defaultZoom);
    setPanOffset(ZERO_OFFSET);
  }, [defaultZoom]);

  // =========================================================================
  // WHEEL ZOOM (non-passive, attached via ref)
  // =========================================================================

  useEffect(() => {
    if (!containerEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY * wheelSensitivity;
      const factor = 1 + delta;

      setZoomRaw(prev => {
        const next = clampZoom(prev * factor);
        if (next <= 1) setPanOffset(ZERO_OFFSET);
        return next;
      });
    };

    containerEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => containerEl.removeEventListener('wheel', handleWheel);
  }, [containerEl, clampZoom, wheelSensitivity]);

  // =========================================================================
  // MOUSE PAN (stable callbacks using refs)
  // =========================================================================

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0 || zoomRef.current <= 1) return;
    e.preventDefault();
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { x: panRef.current.x, y: panRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current) return;
    setPanOffset({
      x: initialPanRef.current.x + (e.clientX - panStartRef.current.x),
      y: initialPanRef.current.y + (e.clientY - panStartRef.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  // =========================================================================
  // TOUCH: PINCH-TO-ZOOM + PAN
  // =========================================================================

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dist = touchDistance(e.touches[0], e.touches[1]);
      pinchDistRef.current = dist;
      pinchZoomRef.current = zoomRef.current;
      isPanningRef.current = false;
      setIsPanning(false);
    } else if (e.touches.length === 1 && zoomRef.current > 1) {
      // Touch pan start
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPanRef.current = { x: panRef.current.x, y: panRef.current.y };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      // Pinch zoom
      e.preventDefault();
      const currentDist = touchDistance(e.touches[0], e.touches[1]);
      const scale = currentDist / pinchDistRef.current;
      setZoomRaw(clampZoom(pinchZoomRef.current * scale));
    } else if (e.touches.length === 1 && isPanningRef.current) {
      // Touch pan
      e.preventDefault();
      const touch = e.touches[0];
      setPanOffset({
        x: initialPanRef.current.x + (touch.clientX - panStartRef.current.x),
        y: initialPanRef.current.y + (touch.clientY - panStartRef.current.y),
      });
    }
  }, [clampZoom]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) {
      isPanningRef.current = false;
      setIsPanning(false);
    }
  }, []);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  const contentStyle: CSSProperties = {
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
  };

  const cursorClass = zoom > 1
    ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
    : 'cursor-default';

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    zoom,
    panOffset,
    isPanning,
    zoomIn,
    zoomOut,
    resetAll,
    containerRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    contentStyle,
    cursorClass,
  };
}
