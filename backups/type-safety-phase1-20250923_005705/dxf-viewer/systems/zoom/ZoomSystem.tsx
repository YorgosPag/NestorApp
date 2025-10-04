'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// Import the main zoom hooks
import { useZoomWindow } from '../../hooks/useZoomWindow';
import { DEFAULT_ZOOM_CONFIG, type ZoomConfig, type ZoomSystemConfig } from './config';

// Context type for zoom system
interface ZoomContextType {
  currentZoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  resetZoom: () => void;
  zoomToRegion: (x: number, y: number, width: number, height: number) => void;
  zoomWindow: ReturnType<typeof useZoomWindow>;
}

// Create context
const ZoomContext = createContext<ZoomContextType | null>(null);

// Use shared zoom configuration from config.ts

// Main zoom system component
export function ZoomSystem({ 
  children,
  config = DEFAULT_ZOOM_CONFIG
}: { 
  children: React.ReactNode;
  config?: Partial<ZoomSystemConfig>;
}) {
  const [currentZoom, setCurrentZoom] = useState(config.initialZoom || DEFAULT_ZOOM_CONFIG.initialZoom);
  const zoomWindow = useZoomWindow();
  
  const finalConfig = { ...DEFAULT_ZOOM_CONFIG, ...config };

  const setZoom = useCallback((zoom: number) => {
    const clampedZoom = Math.max(
      finalConfig.minZoom,
      Math.min(finalConfig.maxZoom, zoom)
    );
    setCurrentZoom(clampedZoom);
  }, [finalConfig.minZoom, finalConfig.maxZoom]);

  const zoomIn = useCallback(() => {
    setZoom(currentZoom * finalConfig.zoomInFactor);
  }, [currentZoom, finalConfig.zoomInFactor, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(currentZoom * finalConfig.zoomOutFactor);
  }, [currentZoom, finalConfig.zoomOutFactor, setZoom]);

  const fitToView = useCallback(() => {
    setZoom(finalConfig.initialZoom);
  }, [finalConfig.initialZoom, setZoom]);

  const resetZoom = useCallback(() => {
    setZoom(finalConfig.initialZoom);
  }, [finalConfig.initialZoom, setZoom]);

  const zoomToRegion = useCallback((x: number, y: number, width: number, height: number) => {
    // Calculate zoom factor based on region size
    // This would need canvas dimensions from context in a real implementation
    const viewportWidth = 800; // Default viewport width
    const viewportHeight = 600; // Default viewport height
    
    const zoomFactorX = viewportWidth / width;
    const zoomFactorY = viewportHeight / height;
    const newZoom = Math.min(zoomFactorX, zoomFactorY) * 0.9; // 90% to add some padding
    
    setZoom(newZoom);
  }, [setZoom]);

  const contextValue: ZoomContextType = {
    currentZoom,
    setZoom,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
    zoomToRegion,
    zoomWindow
  };

  return (
    <ZoomContext.Provider value={contextValue}>
      {children}
    </ZoomContext.Provider>
  );
}

// Hook to access zoom context
export function useZoomContext(): ZoomContextType {
  const context = useContext(ZoomContext);
  
  if (!context) {
    throw new Error('useZoomContext must be used within a ZoomSystem');
  }
  
  return context;
}

// Backward compatibility exports
export const ZoomProvider = ZoomSystem;
export { DEFAULT_ZOOM_CONFIG };
export type { ZoomSystemConfig, ZoomContextType };