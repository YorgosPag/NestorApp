'use client';

/**
 * @module PdfBackgroundCanvas
 * @description Enterprise-grade PDF background canvas component
 *
 * Renders the PDF page as a background image with independent transform controls.
 * Positioned below DXF canvas in z-index hierarchy.
 *
 * @features
 * - Independent pan/zoom (separate from DXF)
 * - Scale/rotation controls
 * - Opacity control
 * - CAD-grade positioning
 *
 * @see ADR-002 for z-index hierarchy
 * @see centralized_systems.md for enterprise patterns
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { PdfBackgroundCanvasProps } from '../types/pdf.types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';

// ============================================================================
// RENDER LOOP MANAGEMENT
// ============================================================================

/**
 * RAF render request state
 * Used to prevent multiple RAF calls
 */
interface RenderRequest {
  frameId: number | null;
  isPending: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Z-index for PDF background layer
 * Uses z-50 to ensure visibility above other canvas layers
 * TODO: Investigate proper layering with transparent backgrounds
 *
 * @see ADR-002 for z-index hierarchy
 */
const PDF_BACKGROUND_Z_INDEX = 'z-50';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PDF Background Canvas Component
 *
 * Renders PDF page as background image with independent transform.
 * Uses canvas for efficient rendering with transform support.
 *
 * @example
 * ```tsx
 * <PdfBackgroundCanvas
 *   imageUrl={renderedImageUrl}
 *   pdfTransform={pdfTransform}
 *   canvasTransform={dxfTransform}
 *   viewport={{ width: 800, height: 600 }}
 *   enabled={true}
 *   opacity={0.5}
 * />
 * ```
 */
export const PdfBackgroundCanvas: React.FC<PdfBackgroundCanvasProps> = ({
  imageUrl,
  pdfTransform,
  canvasTransform,
  viewport,
  enabled,
  opacity,
  className = '',
}) => {
  // ============================================================
  // REFS
  // ============================================================

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const renderRequestRef = useRef<RenderRequest>({ frameId: null, isPending: false });

  // ============================================================
  // IMAGE LOADING
  // ============================================================

  /**
   * Load image from URL
   * Enterprise pattern: Promise-based with proper error handling
   */
  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }, []);

  // ============================================================
  // RENDERING - ENTERPRISE RAF PATTERN
  // ============================================================

  /**
   * 🏢 ENTERPRISE: Render with proper RAF scheduling
   *
   * Based on LayerCanvas.tsx pattern:
   * - Single RAF per frame
   * - Proper cleanup on unmount
   * - Canvas transform integration (DXF pan/zoom synced)
   * - PDF-specific transform overlay (independent scale/rotation)
   */
  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl || !enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Load image if not cached or URL changed
      if (!imageRef.current || imageRef.current.src !== imageUrl) {
        imageRef.current = await loadImage(imageUrl);
      }

      const img = imageRef.current;
      if (!img) return;

      // Set canvas size to viewport
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply global opacity
      ctx.globalAlpha = opacity;

      // Save context state
      ctx.save();

      // ============================================================
      // 🏢 ENTERPRISE: CAD COORDINATE SYSTEM (same as DXF)
      // ============================================================
      // Uses EXACTLY the same coordinate system as DXF rendering:
      // - Origin at bottom-left (after margins)
      // - Y-axis points UP (CAD convention)
      // - World (0,0) = screen (left, height - top)
      // ============================================================

      const { left, top } = COORDINATE_LAYOUT.MARGINS;

      // STEP 1: Move origin to bottom-left of canvas area (CAD origin)
      // This matches DXF worldToScreen: (left, height - top) is world (0,0)
      ctx.translate(left, viewport.height - top);

      // STEP 2: Apply Y-flip for CAD coordinates (Y goes UP, not down)
      ctx.scale(1, -1);

      // STEP 3: Apply DXF canvas transform (zoom/pan)
      // After Y-flip, offsetY works correctly (positive = up)
      ctx.translate(canvasTransform.offsetX, canvasTransform.offsetY);
      ctx.scale(canvasTransform.scale, canvasTransform.scale);

      // STEP 4: Apply PDF-specific transform (user controls from panel)
      ctx.translate(pdfTransform.offsetX, pdfTransform.offsetY);

      // Apply PDF rotation around current position
      ctx.rotate((pdfTransform.rotation * Math.PI) / 180);

      // Apply PDF scale on top of DXF scale
      ctx.scale(pdfTransform.scale, pdfTransform.scale);

      // STEP 5: Draw with bottom-left at world (0,0)
      // After Y-flip, we need to flip the image back so it's not upside-down
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, -img.height);

      // Restore context state
      ctx.restore();

      // Reset global alpha
      ctx.globalAlpha = 1;
    } catch (error) {
      console.error('❌ [PdfBackgroundCanvas] Render error:', error);
    }
  }, [imageUrl, pdfTransform, canvasTransform, viewport, enabled, opacity, loadImage]);

  /**
   * 🏢 ENTERPRISE: Schedule render with requestAnimationFrame
   * Prevents multiple renders per frame (performance optimization)
   */
  const scheduleRender = useCallback(() => {
    if (renderRequestRef.current.isPending) return;

    renderRequestRef.current.isPending = true;
    renderRequestRef.current.frameId = requestAnimationFrame(() => {
      renderRequestRef.current.isPending = false;
      render();
    });
  }, [render]);

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * 🏢 ENTERPRISE: Re-render when any dependency changes
   * Direct call to render() instead of RAF scheduling for reliability
   */
  useEffect(() => {
    // 🏢 ENTERPRISE: Direct render call when deps change
    if (imageUrl && enabled && viewport.width > 0 && viewport.height > 0) {
      render();
    }
  }, [imageUrl, pdfTransform, canvasTransform, viewport, enabled, opacity, render]);

  /**
   * 🏢 ENTERPRISE: Cleanup RAF on unmount
   * Prevents memory leaks and orphaned animation frames
   */
  useEffect(() => {
    return () => {
      if (renderRequestRef.current.frameId !== null) {
        cancelAnimationFrame(renderRequestRef.current.frameId);
        renderRequestRef.current.frameId = null;
      }
    };
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  // Don't render if disabled or no image
  if (!enabled || !imageUrl) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`
        absolute
        ${PANEL_LAYOUT.INSET['0']}
        w-full
        h-full
        ${PDF_BACKGROUND_Z_INDEX}
        ${PANEL_LAYOUT.POINTER_EVENTS.NONE}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      data-testid="pdf-background-canvas"
      data-canvas-type="pdf-background"
    />
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default PdfBackgroundCanvas;
