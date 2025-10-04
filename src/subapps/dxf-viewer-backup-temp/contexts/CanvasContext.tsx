'use client';

import React, { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { ViewTransform } from '../rendering/types/Types';

interface CanvasContextType {
  dxfRef: React.RefObject<any>;
  overlayRef: React.RefObject<any>;
  transform: ViewTransform;
  setTransform: (transform: ViewTransform) => void;
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

  // 🎯 INITIAL TRANSFORM: World (0,0) at bottom-left ruler corner
  // This will be updated when viewport is known, but provides sensible defaults
  const [transform, setTransform] = useState<ViewTransform>({
    scale: 1,
    offsetX: 0,   // Will be set to RULER_WIDTH (30) when viewport available
    offsetY: 0    // Will be set to viewport.height - RULER_HEIGHT when available
  });

  return (
    <CanvasContext.Provider value={{ dxfRef, overlayRef, transform, setTransform }}>
      {children}
    </CanvasContext.Provider>
  );
};