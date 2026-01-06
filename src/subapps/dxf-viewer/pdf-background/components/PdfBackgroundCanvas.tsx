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
 * 🔧 DEBUG: Temporarily set to z-50 to verify visibility
 * TODO: After confirming visibility, change back to z-[-10] or use proper layering
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
      // 🏢 ENTERPRISE: VIEWPORT-CENTERED PDF RENDERING
      // ============================================================
      //
      // PDF renders in SCREEN SPACE (not world space)
      // This ensures PDF is always visible and centered on screen
      // User can then adjust position with pdfTransform controls
      //
      // Benefits:
      // - PDF always visible when loaded
      // - Independent from DXF zoom/pan
      // - User controls alignment via panel
      // ============================================================

      // Calculate viewport center
      const viewportCenterX = viewport.width / 2;
      const viewportCenterY = viewport.height / 2;

      // Apply PDF-specific transform (user controls from panel)
      // pdfTransform.offsetX/Y are adjustments from center
      const pdfCenterX = viewportCenterX + pdfTransform.offsetX;
      const pdfCenterY = viewportCenterY + pdfTransform.offsetY;

      // Move to PDF center position
      ctx.translate(pdfCenterX, pdfCenterY);

      // Apply rotation around center
      ctx.rotate((pdfTransform.rotation * Math.PI) / 180);

      // Apply scale
      ctx.scale(pdfTransform.scale, pdfTransform.scale);

      // Draw image centered at position
      const drawX = -img.width / 2;
      const drawY = -img.height / 2;

      ctx.drawImage(img, drawX, drawY);

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
