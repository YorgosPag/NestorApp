'use client';

import React, { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { DxfCanvasImperativeAPI } from '../canvas/DxfCanvasCore';
import type { OverlayCanvasImperativeAPI } from '../canvas/OverlayCanvasCore';
import type { ViewTransform } from '../types/scene';

interface CanvasContextType {
  dxfRef: React.RefObject<DxfCanvasImperativeAPI>;
  overlayRef: React.RefObject<OverlayCanvasImperativeAPI>;
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
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  return (
    <CanvasContext.Provider value={{ dxfRef, overlayRef, transform, setTransform }}>
      {children}
    </CanvasContext.Provider>
  );
};