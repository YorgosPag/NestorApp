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

import React, { createContext, useContext, useRef, useMemo, useCallback, type ReactNode } from 'react';
// ✅ ENTERPRISE MIGRATION: Using DxfCanvasRef from canvas-v2 (modern API)
import type { DxfCanvasRef } from '../canvas-v2';
// 🏢 ENTERPRISE FIX (2026-01-27): Use canonical ViewTransform from centralized types
// REMOVED duplicate type definition - using Single Source of Truth
import type { ViewTransform } from '../rendering/types/Types';
// ADR-040 Phase XXII.B: setTransform writes ONLY to ImmediateTransformStore (SSoT).
// The legacy `useState<transform>` was removed — it re-rendered CanvasProvider (a
// high-up ancestor of DxfViewerContent) on every wheel notch, cascading 2502 fibers
// (ribbon + 34 tooltips + sidebar). Reactive readers use useTransformValue() /
// useTransformScale(); the volatile contexts below expose a one-shot snapshot only.
import { updateImmediateTransform, getImmediateTransform } from '../systems/cursor/ImmediateTransformStore';

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

  // ADR-040 Phase VII + XXII.B: stable callback — writes ONLY to the
  // ImmediateTransformStore SSoT. No React state update → CanvasProvider stays
  // inert on wheel zoom/pan (was the 2502-fiber cascade root, ADR-040 §Phase XXII.B).
  const setTransform = useCallback((newTransform: ViewTransform) => {
    updateImmediateTransform(newTransform);
  }, []);

  // ADR-040 Phase VII: stable refs value — never recreated (empty deps)
  const refsValue = useMemo<CanvasRefsContextType>(() => ({
    dxfRef,
    overlayRef,
    canvasRef: dxfRef,
    setTransform,
  }), [setTransform]);

  // ADR-040 Phase XXII.B: volatile transform contexts retained for the legacy
  // public API surface only (zero runtime consumers after Phase XXII.A). They
  // expose a one-shot snapshot of the SSoT and intentionally do NOT re-render on
  // zoom/pan — reactive readers must use useTransformValue() / useTransformScale().
  const transform = getImmediateTransform();
  const transformValue = useMemo<CanvasTransformContextType>(
    () => ({ transform }),
    [transform],
  );

  // Legacy merged context — stable snapshot (see note above)
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