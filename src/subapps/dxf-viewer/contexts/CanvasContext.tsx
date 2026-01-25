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

import React, { createContext, useContext, useRef, useState, type ReactNode } from 'react';
// ✅ ENTERPRISE MIGRATION: Using DxfCanvasRef from canvas-v2 (modern API)
import type { DxfCanvasRef } from '../canvas-v2';

// Mock missing types
type OverlayCanvasImperativeAPI = {
  clear: () => void;
  render: () => void;
};

type ViewTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  offsetX?: number;
  offsetY?: number;
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
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 });

  return (
    <CanvasContext.Provider value={{ dxfRef, overlayRef, transform, setTransform, canvasRef: dxfRef }}>
      {children}
    </CanvasContext.Provider>
  );
};