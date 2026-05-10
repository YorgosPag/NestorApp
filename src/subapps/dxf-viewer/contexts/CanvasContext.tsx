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

// ADR-040 Phase VII: split stable refs (never changes) from volatile transform
// (changes on every zoom/pan). Consumers that only need refs subscribe to the
// stable context → they never re-render on zoom.

// ── Stable refs context ────────────────────────────────────────────────────
interface CanvasRefsContextType {
  dxfRef: React.RefObject<DxfCanvasRef>;
  overlayRef: React.RefObject<OverlayCanvasImperativeAPI>;
  canvasRef: React.RefObject<DxfCanvasRef>;
  setTransform: (transform: ViewTransform) => void;
}

const CanvasRefsContext = createContext<CanvasRefsContextType | null>(null);

export const useCanvasRefs = (): CanvasRefsContextType | null =>
  useContext(CanvasRefsContext);

// ── Transform context (changes on zoom/pan) ─────────────────────────────
interface CanvasTransformContextType {
  transform: ViewTransform;
}

const CanvasTransformContext = createContext<CanvasTransformContextType | null>(null);

export const useCanvasTransformContext = (): CanvasTransformContextType | null =>
  useContext(CanvasTransformContext);

// ── Legacy merged context (backward compat — use only where transform is needed) ──
interface CanvasContextType extends CanvasRefsContextType {
  transform: ViewTransform;
  zoomManager?: {
    zoomIn: () => void;
    zoomOut: () => void;
    zoomToFit: () => void;
    zoomTo100: (center?: { x: number; y: number }) => void;
    zoomToScale: (scale: number, center?: { x: number; y: number }) => void;
    resetZoom: () => void;
  };
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export const useCanvasContext = (): CanvasContextType | null =>
  useContext(CanvasContext);

interface CanvasProviderProps {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const dxfRef = useRef<DxfCanvasRef>(null);
  const overlayRef = useRef<OverlayCanvasImperativeAPI>(null);
  const [transform, setTransformInternal] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  // ADR-040 Phase VII: stable callback — created once on mount
  const setTransform = useCallback((newTransform: ViewTransform) => {
    setTransformInternal(newTransform);
  }, []);

  // ADR-040 Phase VII: stable refs value — never recreated (empty deps)
  const refsValue = useMemo<CanvasRefsContextType>(() => ({
    dxfRef,
    overlayRef,
    canvasRef: dxfRef,
    setTransform,
  }), [setTransform]);

  // Transform context — recreated only when transform changes
  const transformValue = useMemo<CanvasTransformContextType>(
    () => ({ transform }),
    [transform],
  );

  // Legacy merged context — for CanvasSection which needs both
  const contextValue = useMemo<CanvasContextType>(
    () => ({ ...refsValue, transform }),
    [refsValue, transform],
  );

  return (
    <CanvasRefsContext.Provider value={refsValue}>
      <CanvasTransformContext.Provider value={transformValue}>
        <CanvasContext.Provider value={contextValue}>
          {children}
        </CanvasContext.Provider>
      </CanvasTransformContext.Provider>
    </CanvasRefsContext.Provider>
  );
};