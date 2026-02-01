/**
 * 🏢 ENTERPRISE: useCanvasResize Hook
 *
 * @description Centralized canvas resize logic with ResizeObserver support
 * @see ADR-118: Canvas Viewport Hook Centralization
 *
 * PROBLEM: ~70 lines of EXACT DUPLICATE code between DxfCanvas and LayerCanvas:
 * - viewportRef + internalViewport state management
 * - viewport priority resolution (viewportProp > ref > state)
 * - Conditional ResizeObserver (only when no viewportProp)
 * - Window resize fallback
 * - Synchronous ref updates for render loop
 *
 * SOLUTION: Extract to centralized useCanvasResize hook
 *
 * PATTERN: SSoT from container when viewportProp provided, local ResizeObserver as fallback
 */

'use client';

import {
  useRef,
  useState,
  useEffect,
  type RefObject,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Viewport } from '../../rendering/types/Types';

// ============================================================================
// TYPES
// ============================================================================

export interface UseCanvasResizeOptions {
  /** Canvas element ref */
  canvasRef: RefObject<HTMLCanvasElement | null>;

  /** Viewport from parent (SSoT when provided) */
  viewportProp?: Viewport;

  /** Optional callback when canvas needs setup (e.g., CanvasUtils.setupCanvasContext) */
  onSetupCanvas?: () => void;
}

export interface UseCanvasResizeResult {
  /** Resolved viewport (priority: viewportProp > viewportRef > state) */
  viewport: Viewport;

  /** Viewport ref for synchronous access (render loop) */
  viewportRef: MutableRefObject<Viewport>;

  /** Internal viewport state for React dependencies */
  internalViewport: Viewport;

  /** State setter (needed by setupCanvas callbacks) */
  setInternalViewport: Dispatch<SetStateAction<Viewport>>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized canvas resize hook
 *
 * Features:
 * - SSoT viewport from parent when viewportProp provided
 * - Local ResizeObserver as fallback when no parent viewport
 * - Synchronous ref updates for render loop (no React batching lag)
 * - Window resize fallback for non-element resizes
 *
 * @example
 * ```tsx
 * const { viewport, viewportRef, setInternalViewport } = useCanvasResize({
 *   canvasRef,
 *   viewportProp,
 *   onSetupCanvas: setupCanvas,
 * });
 * ```
 */
export function useCanvasResize({
  canvasRef,
  viewportProp,
  onSetupCanvas,
}: UseCanvasResizeOptions): UseCanvasResizeResult {
  // ============================================================================
  // STATE & REFS
  // ============================================================================

  // 🏢 ENTERPRISE: Synchronous viewport store for render loop (no React lag)
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });

  // ✅ LEGACY: Keep state for React re-renders (dependencies, UI updates)
  // But NEVER use this for coordinate transforms - use viewportRef instead
  const [internalViewport, setInternalViewport] = useState<Viewport>({ width: 0, height: 0 });

  // ============================================================================
  // VIEWPORT PRIORITY RESOLUTION
  // ============================================================================

  // 🎯 CRITICAL: viewportProp FIRST (from container) - ensures Input/Render use SAME source
  // viewportProp = CanvasSection's viewportRef.current (container-based, FRESH)
  // Local viewportRef = canvas-based (different element, causes DRIFT!)
  const viewport = (viewportProp && viewportProp.width > 0 && viewportProp.height > 0)
    ? viewportProp  // ✅ ALWAYS use container-based viewport from parent
    : (viewportRef.current.width > 0 && viewportRef.current.height > 0)
      ? viewportRef.current  // Fallback only if parent didn't provide
      : internalViewport;

  // ============================================================================
  // RESIZE OBSERVER EFFECT
  // ============================================================================

  useEffect(() => {
    // Call setup callback on mount
    onSetupCanvas?.();

    // 🏢 ENTERPRISE (2026-01-31): ResizeObserver ONLY when NO viewportProp
    // PROBLEM: Multiple ResizeObservers (container + canvas) cause race conditions
    // SOLUTION: If parent provides viewportProp, parent's ResizeObserver is SSoT
    // Canvas ResizeObserver only runs as FALLBACK when no viewportProp
    let resizeObserver: ResizeObserver | null = null;
    const canvas = canvasRef.current;
    const hasParentViewport = viewportProp && viewportProp.width > 0 && viewportProp.height > 0;

    // Only setup local ResizeObserver if NO parent viewport (standalone mode)
    if (canvas && !hasParentViewport) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            // 🎯 CRITICAL: Update ref SYNCHRONOUSLY (no React batching)
            viewportRef.current = { width, height };
            // Also trigger React state update for dependencies
            setInternalViewport({ width, height });
          }
        }
      });
      resizeObserver.observe(canvas);
    }

    // Fallback: window resize for non-element resizes
    const handleResize = () => onSetupCanvas?.();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [viewportProp?.width, viewportProp?.height, canvasRef, onSetupCanvas]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    viewport,
    viewportRef,
    internalViewport,
    setInternalViewport,
  };
}
