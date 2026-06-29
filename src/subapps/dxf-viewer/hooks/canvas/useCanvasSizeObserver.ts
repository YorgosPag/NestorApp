/**
 * 🏢 ADR-146: Canvas Size Observer Hook Centralization
 *
 * Combines ResizeObserver with callback for canvas size updates.
 * Use this when you need to react to canvas size changes.
 *
 * Pattern: AutoCAD/Figma - ResizeObserver for responsive canvas sizing
 *
 * @module useCanvasSizeObserver
 * @version 1.0.0
 * @since 2026-02-01
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Single Source of Truth for ResizeObserver + canvas pattern
 * - Zero duplicate ResizeObserver setup code
 * - skipZeroDimensions option (prevents invalid renders)
 * - Full TypeScript (ZERO any)
 *
 * @example
 * ```tsx
 * useCanvasSizeObserver({
 *   canvasRef,
 *   onSizeChange: useCallback((canvas) => {
 *     CanvasUtils.setupCanvasContext(canvas, { enableHiDPI: true });
 *   }, []),
 * });
 * ```
 */

import { useEffect, type RefObject } from 'react';
import { subscribeDevicePixelRatio } from '../../systems/cursor/device-pixel-ratio'; // ADR-549 Phase 7

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

export interface UseCanvasSizeObserverOptions {
  /** Canvas element ref */
  canvasRef: RefObject<HTMLCanvasElement | null>;

  /** Callback when canvas size changes - receives canvas element */
  onSizeChange: (canvas: HTMLCanvasElement) => void;

  /** Skip callback if dimensions are zero (default: true) */
  skipZeroDimensions?: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Canvas Size Observer Hook
 *
 * Combines ResizeObserver with callback for canvas size updates.
 * Eliminates duplicate ResizeObserver setup code across components.
 *
 * @param options - Configuration options
 * @returns void
 */
export function useCanvasSizeObserver({
  canvasRef,
  onSizeChange,
  skipZeroDimensions = true,
}: UseCanvasSizeObserverOptions): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      // 🏢 ENTERPRISE: Skip zero dimensions to prevent invalid canvas operations
      if (skipZeroDimensions) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
      }
      onSizeChange(canvas);
    };

    // Initial call - setup canvas on mount
    handleResize();

    // Setup ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    // ADR-549 Phase 7 — a devicePixelRatio change fires no ResizeObserver; re-run setup so the
    // backing store re-rasterizes at the new dpr (monitor/scaling switch → no stale region).
    const unsubDpr = subscribeDevicePixelRatio(handleResize);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      unsubDpr();
    };
  }, [canvasRef, onSizeChange, skipZeroDimensions]);
}

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ Single Source of Truth for ResizeObserver pattern
 * ✅ skipZeroDimensions prevents invalid canvas operations
 * ✅ Proper cleanup via disconnect()
 * ✅ Initial call on mount
 * ✅ Full TypeScript support (ZERO any)
 * ✅ Works with CanvasUtils.setupCanvasContext (ADR-115)
 * ✅ Works with getDevicePixelRatio (ADR-094)
 * ✅ Works with toDevicePixels (ADR-117)
 */
