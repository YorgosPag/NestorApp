/**
 * Canvas Operations Hook
 * Provides imperative operations for canvas manipulation
 * UPDATED FOR CANVAS V2: Uses canvas-v2 system
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { useCanvasContext } from '../../contexts/CanvasContext';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Import κεντρικής υπηρεσίας αντί για διάσπαρτη fit logic
import { FitToViewService } from '../../services/FitToViewService';

export interface CanvasOperations {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  setTransform: (transform: ViewTransform) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point2D) => void;
  resetToOrigin: () => void;
  fitToView: () => void;
}

/**
 * Hook that provides canvas operations for Canvas V2 system
 * Falls back to event-based approach if context not available
 */
export const useCanvasOperations = (): CanvasOperations => {
  // 🔺 PHASE 1: Ενοποιημένο API με κοινό transform για DXF+Overlays
  const context = useCanvasContext();
  const dxfRef = context?.dxfRef || null;
  const overlayRef = context?.overlayRef || null;


  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    if (dxfRef?.current) {
      return dxfRef.current.getCanvas();
    }
    // Fallback: find canvas directly from DOM
    return document.querySelector('canvas[data-canvas-type="dxf-main"]') as HTMLCanvasElement || null;
  }, [dxfRef]);

  const getTransform = useCallback((): ViewTransform => {
    if (context?.transform) {
      return context.transform;
    }
    // Fallback: get from Canvas V2
    if (dxfRef?.current?.getTransform) {
      return dxfRef.current.getTransform();
    }
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }, [context, dxfRef]);

  // ✅ Safe transform function με validation για NaN values και unchanged optimization
  const safeSetTransform = useCallback((transform: ViewTransform) => {
    if (!transform) return;

    // Sanitize values - αποφυγή NaN που προκαλεί flickering
    let sanitizedTransform = { ...transform };
    if (!Number.isFinite(sanitizedTransform.scale) || sanitizedTransform.scale <= 0) {
      console.warn('🚨 [safeSetTransform] Invalid scale detected, resetting to 1:', sanitizedTransform.scale);
      sanitizedTransform.scale = 1;
    }
    if (!Number.isFinite(sanitizedTransform.offsetX)) {
      console.warn('🚨 [safeSetTransform] Invalid offsetX detected, resetting to 0:', sanitizedTransform.offsetX);
      sanitizedTransform.offsetX = 0;
    }
    if (!Number.isFinite(sanitizedTransform.offsetY)) {
      console.warn('🚨 [safeSetTransform] Invalid offsetY detected, resetting to 0:', sanitizedTransform.offsetY);
      sanitizedTransform.offsetY = 0;
    }

    // ✅ OPTIMIZATION: Skip update if values unchanged to prevent infinite loops
    const current = getTransform();
    if (current.scale === sanitizedTransform.scale &&
        current.offsetX === sanitizedTransform.offsetX &&
        current.offsetY === sanitizedTransform.offsetY) {
      return; // No change, skip update
    }

    // Update shared context state first
    if (context?.setTransform) {
      context.setTransform(sanitizedTransform);
    }

    // Apply to both DXF and Overlay canvases
    if (dxfRef?.current?.setTransform) {
      dxfRef.current.setTransform(sanitizedTransform);
    }
    if (overlayRef?.current?.setTransform) {
      overlayRef.current.setTransform(sanitizedTransform);
    }

    // Emit zoom event for HUD synchronization με safe values
    const zoomEvent = new CustomEvent('dxf-zoom-changed', {
      detail: { scale: sanitizedTransform.scale, transform: sanitizedTransform }
    });
    document.dispatchEvent(zoomEvent);
  }, [context, dxfRef, overlayRef]);

  const setTransform = safeSetTransform;

  const zoomIn = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.zoomIn();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'in' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const zoomOut = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.zoomOut();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'out' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const zoomAtScreenPoint = useCallback((factor: number, screenPt: Point2D) => {
    if (dxfRef?.current) {
      dxfRef.current.zoomAtScreenPoint(factor, screenPt);
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', {
        detail: { action: 'at-point', factor, point: screenPt }
      });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const resetToOrigin = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.resetToOrigin();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'reset' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Αντικατάσταση διάσπαρτης fitToView logic με κεντρική υπηρεσία
  const fitToView = useCallback(() => {
    console.log('🔧 useCanvasOperations.fitToView called!', { dxfRefExists: !!dxfRef?.current });

    // Προτεραιότητα: Χρήση DxfCanvas reference αν υπάρχει (ήδη κεντρικοποιημένη)
    if (dxfRef?.current && dxfRef.current.fitToView) {
      console.log('🔧 Using dxfRef.current.fitToView() - κεντρικοποιημένη μέθοδος');
      dxfRef.current.fitToView();
      return;
    }

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Fallback με κεντρική υπηρεσία αντί για custom events
    console.log('🔧 Using FitToViewService fallback approach - ΔΙΠΛΟΤΥΠΟ ΑΦΑΙΡΕΘΗΚΕ');
    const canvas = document.querySelector('.dxf-canvas') as HTMLCanvasElement;
    if (canvas) {
      const container = canvas.closest('.relative.w-full.h-full.overflow-hidden');
      if (container) {
        const rect = container.getBoundingClientRect();
        console.log('🔧 Container rect:', { width: rect.width, height: rect.height });

        // ⚠️ ΠΕΡΙΟΡΙΣΜΟΣ: Δεν έχουμε πρόσβαση σε scene/colorLayers εδώ
        // Διατηρείται το custom event για συμβατότητα, αλλά τώρα με σχόλιο
        // TODO: Μελλοντικά να συνδεθεί με CanvasContext για scene/colorLayers access
        const event = new CustomEvent('canvas-fit-to-view', {
          detail: {
            viewport: { width: rect.width, height: rect.height },
            // Προσθήκη metadata για μελλοντική κεντρικοποίηση
            useCentralizedService: true,
            fallbackReason: 'No scene/colorLayers access in useCanvasOperations'
          }
        });
        console.log('🔧 Dispatching canvas-fit-to-view event (legacy fallback)');
        document.dispatchEvent(event);
      }
    }
  }, [dxfRef]);

  return {
    getCanvas,
    getTransform,
    setTransform,
    zoomIn,
    zoomOut,
    zoomAtScreenPoint,
    resetToOrigin,
    fitToView,
  };
};