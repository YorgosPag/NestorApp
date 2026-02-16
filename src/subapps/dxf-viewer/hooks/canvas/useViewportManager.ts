/**
 * 🏢 ENTERPRISE: useViewportManager Hook
 *
 * @description Centralized viewport measurement and management for CanvasSection.
 * Owns the viewport state, ResizeObserver lifecycle, and RAF-delayed initial measurement.
 *
 * EXTRACTED FROM: CanvasSection.tsx (lines ~165-501) — ~230 lines of viewport logic
 *
 * RESPONSIBILITIES:
 * 1. viewport state (width/height) — React state + synchronous ref
 * 2. viewportRef — zero-lag synchronous viewport for non-React consumers
 * 3. transformRef — kept in sync for ResizeObserver offset adjustment
 * 4. ResizeObserver on containerRef — auto-updates viewport + adjusts offsetY on height change
 * 5. RAF-delayed initial measurement — ensures correct dimensions after browser layout stabilization
 *
 * COUPLING: ZERO with drawing/selection/overlay logic
 * DEPENDENCIES: containerRef, transform, setTransform (injected)
 */

'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type RefObject,
  type MutableRefObject,
} from 'react';

import type { ViewTransform } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { dlog, dwarn } from '../../debug';

// ============================================================================
// TYPES
// ============================================================================

/** Viewport dimensions */
interface Viewport {
  width: number;
  height: number;
}

export interface UseViewportManagerParams {
  /** Container element ref — canonical element for all viewport measurements */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current transform (read-only, kept in sync via ref for ResizeObserver) */
  transform: ViewTransform;
  /** Callback to update transform (used for offsetY adjustment on resize) */
  setTransform: (t: ViewTransform) => void;
  /** Optional callback when viewport changes (e.g., PDF store sync) */
  onViewportChange?: (viewport: Viewport) => void;
}

export interface UseViewportManagerReturn {
  /** Current viewport dimensions (React state — triggers re-renders) */
  viewport: Viewport;
  /** Synchronous viewport ref — zero React lag, for non-React consumers */
  viewportRef: MutableRefObject<Viewport>;
  /** Whether viewport has valid (non-zero) dimensions */
  viewportReady: boolean;
  /** Wrapper setTransform that updates transformRef synchronously */
  setTransform: (t: ViewTransform) => void;
  /** Synchronous transform ref */
  transformRef: MutableRefObject<ViewTransform>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useViewportManager({
  containerRef,
  transform,
  setTransform: externalSetTransform,
  onViewportChange,
}: UseViewportManagerParams): UseViewportManagerReturn {

  // ── State ──────────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });

  // ── Refs (synchronous, zero React lag) ─────────────────────────────────
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });
  const transformRef = useRef<ViewTransform>(transform);

  // Keep transformRef in sync every render (for ResizeObserver callback)
  transformRef.current = transform;

  // ── setTransform wrapper (sync ref + async React) ──────────────────────
  const setTransform = useCallback((newTransform: ViewTransform) => {
    transformRef.current = newTransform;
    externalSetTransform(newTransform);
  }, [externalSetTransform]);

  // ── Internal: apply a new viewport to all targets ──────────────────────
  const applyViewport = useCallback((newViewport: Viewport) => {
    viewportRef.current = newViewport;
    setViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // ── ResizeObserver lifecycle ────────────────────────────────────────────
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    const updateViewport = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          applyViewport({ width: rect.width, height: rect.height });
        }
      }
    };

    const setupObserver = () => {
      const container = containerRef.current;
      if (!container) return;

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) continue;

          // ── Adjust transform.offsetY when height changes ──────────
          // Keeps world origin at same screen position when toolbar opens/closes
          const oldHeight = viewportRef.current.height;
          const deltaHeight = height - oldHeight;

          if (oldHeight > 0 && Math.abs(deltaHeight) > 0.5) {
            const currentTransform = transformRef.current;
            const newOffsetY = currentTransform.offsetY + deltaHeight;
            const newTransform = {
              ...currentTransform,
              offsetY: newOffsetY,
            };

            const timestamp = performance.now().toFixed(0);
            dlog('Canvas', `[${timestamp}ms][ResizeObserver] ADJUSTING:
  oldHeight=${oldHeight.toFixed(1)}, newHeight=${height.toFixed(1)}, deltaHeight=${deltaHeight.toFixed(1)}
  oldOffsetY=${currentTransform.offsetY.toFixed(1)}, newOffsetY=${newOffsetY.toFixed(1)}
  transformRef.current.offsetY BEFORE=${transformRef.current.offsetY.toFixed(1)}`);

            // Update ref synchronously FIRST, then React state
            transformRef.current = newTransform;
            externalSetTransform(newTransform);

            dlog('Canvas', `[${timestamp}ms][ResizeObserver] AFTER: transformRef.current.offsetY=${transformRef.current.offsetY.toFixed(1)}`);
          } else {
            dlog('Canvas', `[ResizeObserver] SKIP adjust: oldHeight=${oldHeight.toFixed(1)}, deltaHeight=${deltaHeight.toFixed(1)}`);
          }

          // Apply new viewport dimensions
          applyViewport({ width, height });
          // Clear cached canvas bounds on resize
          canvasBoundsService.clearCache();
        }
      });

      resizeObserver.observe(container);
      // Initial measurement
      updateViewport();
    };

    // ── Retry mechanism for container mount timing ────────────────────
    let retryCount = 0;
    const maxRetries = 10;

    const trySetupObserver = () => {
      const container = containerRef.current;
      if (container) {
        setupObserver();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);
      } else {
        dwarn('useViewportManager', 'Container not available after', maxRetries, 'retries');
      }
    };

    const timer = setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);
    window.addEventListener('resize', updateViewport);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateViewport);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Setup once — ResizeObserver handles updates

  // ── RAF-delayed initial measurement ────────────────────────────────────
  // Ensures correct dimensions after browser layout stabilization (server restart edge case)
  useEffect(() => {
    const forceViewportUpdate = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          applyViewport({ width: rect.width, height: rect.height });
        }
      }
    };

    const cancelScheduled = UnifiedFrameScheduler.scheduleOnceDelayed(
      'canvas-section-viewport-layout',
      forceViewportUpdate,
      PANEL_LAYOUT.TIMING.VIEWPORT_LAYOUT_STABILIZATION,
    );

    return cancelScheduled;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── Derived ────────────────────────────────────────────────────────────
  const viewportReady = viewport.width > 0 && viewport.height > 0;

  return {
    viewport,
    viewportRef,
    viewportReady,
    setTransform,
    transformRef,
  };
}
