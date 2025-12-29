'use client';

import React, { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { DxfCanvasImperativeAPI } from '../canvas/DxfCanvasCore';

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
  dxfRef: React.RefObject<DxfCanvasImperativeAPI>;
  overlayRef: React.RefObject<OverlayCanvasImperativeAPI>;
  transform: ViewTransform;
  setTransform: (transform: ViewTransform) => void;
  // ✅ ENTERPRISE: Alias for dxfRef (used in DxfCanvas.tsx)
  canvasRef: React.RefObject<DxfCanvasImperativeAPI>;

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
  const dxfRef = useRef<DxfCanvasImperativeAPI>(null);
  const overlayRef = useRef<OverlayCanvasImperativeAPI>(null);
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 });

  return (
    <CanvasContext.Provider value={{ dxfRef, overlayRef, transform, setTransform, canvasRef: dxfRef }}>
      {children}
    </CanvasContext.Provider>
  );
};