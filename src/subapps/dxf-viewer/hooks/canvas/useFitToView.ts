/**
 * 🏢 ENTERPRISE: useFitToView Hook
 *
 * @description Fit-to-view and fit-to-overlay zoom functionality.
 * - fitToOverlay(): Zoom to a specific overlay's bounding box
 * - EventBus listener: Handles 'canvas-fit-to-view' events (Shift+1)
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~75 lines of fit-to-view logic
 */

'use client';

import { useEffect, type RefObject } from 'react';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { getPointerSnapshotFromElement } from '../../rendering/core/CoordinateTransforms';
import { EventBus } from '../../systems/events';
// ADR-375 Phase B.4 — explicit «Fit annotations» → recompute the fit-to-paper scale.
import { computeFitToPaperScale } from '../../systems/dimensions/auto-drawing-scale';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { serviceRegistry } from '../../services';
import { dwarn, derr } from '../../debug';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { Overlay } from '../../overlays/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

// ADR-400: payload type for canvas-restore-viewport event.
interface RestoreViewportPayload {
  transform: ViewTransform;
}

// ============================================================================
// TYPES
// ============================================================================

/** Subset of useZoom return type — only the methods used by this hook */
interface ZoomSystemLike {
  zoomToFit: (
    bounds: { min: Point2D; max: Point2D },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean,
  ) => { transform: ViewTransform } | null;
  setTransform: (transform: ViewTransform) => void;
}

export interface UseFitToViewParams {
  /** DXF scene data for combined bounds calculation */
  dxfScene: DxfScene | null;
  /** Overlay color layers for combined bounds calculation */
  colorLayers: ColorLayer[];
  /** Zoom system for transform operations */
  zoomSystem: ZoomSystemLike;
  /** Transform setter from viewport manager */
  setTransform: (t: ViewTransform) => void;
  /** Container ref for viewport snapshot */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current level's overlays */
  currentOverlays: Overlay[];
}

export interface UseFitToViewReturn {
  /** Zoom to a specific overlay's bounding box */
  fitToOverlay: (overlayId: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFitToView({
  dxfScene,
  colorLayers,
  zoomSystem,
  setTransform,
  containerRef,
  currentOverlays,
}: UseFitToViewParams): UseFitToViewReturn {

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: FIT TO OVERLAY - Χρήση κεντρικής υπηρεσίας αντί για διάσπαρτη logic
  const fitToOverlay = (overlayId: string) => {
    const overlay = currentOverlays.find(o => o.id === overlayId);
    if (!overlay || !overlay.polygon || overlay.polygon.length < 3) {
      return;
    }

    // Calculate bounding box of overlay polygon
    const xs = overlay.polygon.map(([x]) => x);
    const ys = overlay.polygon.map(([, y]) => y);
    const bounds = {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) }
    };

    // ✅ ENTERPRISE MIGRATION: Get service from registry
    const fitToView = serviceRegistry.get('fit-to-view');
    // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT)
    // All viewport calculations use container for consistency
    const container = containerRef.current;
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) {
      dwarn('useFitToView', 'fitViewToBounds: Cannot fit - viewport not ready');
      return; // 🏢 Fail-fast: Cannot fit without valid viewport
    }
    const result = fitToView.calculateFitToViewFromBounds(bounds, snap.viewport, { padding: 0.1 });

    if (result.success && result.transform) {
      // Apply transform to zoom system
      zoomSystem.setTransform(result.transform);
    }
  };

  // Handle fit-to-view event from useCanvasOperations fallback
  // 🏢 ENTERPRISE: Unified EventBus.on — receives events from all dispatchers
  useEffect(() => {
    const handleFitToView = () => {
      // 🚀 USE COMBINED BOUNDS - DXF + overlays
      // 🏢 FIX (2026-01-04): forceRecalculate=true includes dynamically drawn entities
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);

      if (combinedBounds) {
        // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT)
        // All viewport calculations use container for consistency
        const container = containerRef.current;
        const snap = getPointerSnapshotFromElement(container);
        if (!snap) {
          dwarn('useFitToView', 'handleFitToView: Cannot fit - viewport not ready');
          return; // 🏢 Fail-fast: Cannot fit without valid viewport
        }

        try {
          // 🎯 ENTERPRISE: preserve original origin (allow negative coordinates)
          const zoomResult = zoomSystem.zoomToFit(combinedBounds, snap.viewport, false);

          // 🔥 ΚΡΙΣΙΜΟ: Εφαρμογή του νέου transform με null checks + NaN guards
          if (zoomResult && zoomResult.transform) {
            const { scale, offsetX, offsetY } = zoomResult.transform;

            // 🛡️ GUARD: Check for NaN values before applying transform
            if (isNaN(scale) || isNaN(offsetX) || isNaN(offsetY)) {
              derr('useFitToView', '🚨 Shift+1 failed: Invalid transform (NaN values)');
              return;
            }

            setTransform(zoomResult.transform);
          }
        } catch (error) {
          derr('useFitToView', '🚨 Shift+1 failed:', error);
        }
      }
    };

    // ADR-394: fit to the selection's pre-computed bounds (Z key). Bounds arrive
    // ready from useKeyboardShortcuts (DXF + BIM), so this only maps bounds→transform.
    const handleFitToViewSelected = (payload: { bounds: { min: Point2D; max: Point2D } }) => {
      const bounds = payload?.bounds;
      if (!bounds) return;

      const container = containerRef.current;
      const snap = getPointerSnapshotFromElement(container);
      if (!snap) {
        dwarn('useFitToView', 'handleFitToViewSelected: Cannot fit - viewport not ready');
        return; // 🏢 Fail-fast: Cannot fit without valid viewport
      }

      try {
        const zoomResult = zoomSystem.zoomToFit(bounds, snap.viewport, false);
        if (zoomResult && zoomResult.transform) {
          const { scale, offsetX, offsetY } = zoomResult.transform;
          if (isNaN(scale) || isNaN(offsetX) || isNaN(offsetY)) {
            derr('useFitToView', '🚨 Z fit-to-selection failed: Invalid transform (NaN values)');
            return;
          }
          setTransform(zoomResult.transform);
        }
      } catch (error) {
        derr('useFitToView', '🚨 Z fit-to-selection failed:', error);
      }
    };

    // ADR-400: Restore a persisted viewport transform (absolute, no bounds calc needed).
    const handleRestoreViewport = (payload: RestoreViewportPayload) => {
      const { scale, offsetX, offsetY } = payload.transform;
      if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
        derr('useFitToView', '🚨 canvas-restore-viewport: invalid transform, ignoring');
        return;
      }
      setTransform(payload.transform);
    };

    // ADR-375 Phase B.4 — «Fit annotations»: recompute the fit-to-paper 1:N from the
    // live combined bounds (mm) and FORCE it, overriding any manual scale on request.
    const handleFitAnnotationsToPaper = () => {
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);
      if (!combinedBounds) return;
      const scale = computeFitToPaperScale(combinedBounds);
      if (scale != null) {
        useBimRenderSettingsStore.getState().applyAutoDrawingScale(scale, { force: true });
      }
    };

    const cleanup = EventBus.on('canvas-fit-to-view', handleFitToView);
    const cleanupSelected = EventBus.on('canvas-fit-to-view-selected', handleFitToViewSelected);
    const cleanupRestore = EventBus.on('canvas-restore-viewport', handleRestoreViewport);
    const cleanupFitAnnotations = EventBus.on('annotation-fit-to-paper', handleFitAnnotationsToPaper);
    return () => { cleanup(); cleanupSelected(); cleanupRestore(); cleanupFitAnnotations(); };
  }, [dxfScene, colorLayers, zoomSystem]); // 🚀 Include colorLayers για combined bounds

  return { fitToOverlay };
}
