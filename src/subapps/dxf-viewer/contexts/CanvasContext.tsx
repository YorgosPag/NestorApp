'use client';

/**
 * 🏢 ENTERPRISE: Canvas Context
 *
 * Provides centralized canvas references and transform state.
 * Uses DxfCanvasRef from canvas-v2 (modern, simplified API).
 *
 * @version 2.0.0 - Migrated from legacy canvas/ to canvas-v2/
 * @since 2025-01-25
 */

import React, { createContext, useContext, useRef, useState, useMemo, useCallback, type ReactNode } from 'react';
// ✅ ENTERPRISE MIGRATION: Using DxfCanvasRef from canvas-v2 (modern API)
import type { DxfCanvasRef } from '../canvas-v2';
// 🏢 ENTERPRISE FIX (2026-01-27): Use canonical ViewTransform from centralized types
// REMOVED duplicate type definition - using Single Source of Truth
import type { ViewTransform } from '../rendering/types/Types';

// Mock missing types
type OverlayCanvasImperativeAPI = {
  clear: () => void;
  render: () => void;
};

interface CanvasContextType {
  dxfRef: React.RefObject<DxfCanvasRef>;
  overlayRef: React.RefObject<OverlayCanvasImperativeAPI>;
  transform: ViewTransform;
  setTransform: (transform: ViewTransform) => void;
  // ✅ ENTERPRISE: Alias for dxfRef (used in DxfCanvas.tsx)
  canvasRef: React.RefObject<DxfCanvasRef>;

  // ✅ ENTERPRISE FIX: Missing zoomManager for useKeyboardShortcuts TS2339 error
  zoomManager?: {
    zoomIn: () => void;
    zoomOut: () => void;
    zoomToFit: () => void;
    zoomTo100: (center?: { x: number; y: number }) => void;
    zoomToScale: (scale: number, center?: { x: number; y: number }) => void; // ✅ ENTERPRISE FIX: Added zoomToScale method
    resetZoom: () => void;
  };
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export const useCanvasContext = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    // Return null instead of throwing error to allow fallback behavior
    return null;
  }
  return context;
};

interface CanvasProviderProps {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  // ✅ ENTERPRISE MIGRATION: Using DxfCanvasRef from canvas-v2
  const dxfRef = useRef<DxfCanvasRef>(null);
  const overlayRef = useRef<OverlayCanvasImperativeAPI>(null);
  // 🏢 ENTERPRISE FIX (2026-01-27): Use canonical ViewTransform format (scale, offsetX, offsetY only)
  const [transform, setTransformInternal] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  // 🏢 ENTERPRISE (2026-01-27): Stable setTransform reference
  // ADR: Context transform is TELEMETRY only, imperative API is control plane
  const setTransform = useCallback((newTransform: ViewTransform) => {
    setTransformInternal(newTransform);
  }, []);

  // 🏢 ENTERPRISE (2026-01-27): Memoize context value to prevent DxfCanvas from unmounting
  // Only recreate when transform changes, not on every render
  const contextValue = useMemo(() => ({
    dxfRef,
    overlayRef,
    transform,
    setTransform,
    canvasRef: dxfRef
  }), [transform]);

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};