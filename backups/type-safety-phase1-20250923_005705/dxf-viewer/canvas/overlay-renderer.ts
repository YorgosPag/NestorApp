/**
 * Overlay Renderer - UNIFIED VERSION με GRIP SETTINGS SUPPORT
 * Χρησιμοποιεί μόνο unified coordinate system + live grip settings
 */

// ✅ Debug flag for overlay renderer logging
const DEBUG_CANVAS_CORE = false;

import type { Region, Point2D } from '../types/overlay';
import type { ViewTransform } from '../systems/rulers-grid/config';
import type { GripSettings } from '../types/gripSettings';
import { coordTransforms } from '../systems/rulers-grid/config';
import { OverlayDrawingEngine, type OverlayRenderOptions } from '../utils/overlay-drawing';

export class OverlayRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawingEngine: OverlayDrawingEngine;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D rendering context');
    this.ctx = ctx;
    this.drawingEngine = new OverlayDrawingEngine(ctx);
  }

  // === ENHANCED RENDER WITH GRIP SETTINGS ===
  renderOverlay(
    regions: Region[], 
    transform: ViewTransform, 
    options: OverlayRenderOptions = {},
    gripSettings?: GripSettings, // === ΝΕΟ: GRIP SETTINGS PARAM ===
    gripPreview?: { entityId: string; next: { vertices?: Point2D[]; start?: Point2D; end?: Point2D } } | null // === ΝΕΟ: GRIP PREVIEW ===
  ): void {
    if (DEBUG_CANVAS_CORE) console.log('🎨 [OverlayRenderer] renderOverlay called with gripSettings:', gripSettings);
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const canvasRect = this.canvas.getBoundingClientRect();
    const canvasHeight = canvasRect.height;

    // === PASS GRIP SETTINGS TO DRAWING ENGINE ===
    const enhancedOptions = { ...options, gripSettings };

    for (const region of regions) {
      if (region.visible) {
        // ✅ Check if this region has a grip preview
        if (gripPreview && gripPreview.entityId === region.id && gripPreview.next.vertices) {
          // Create a preview region with updated vertices
          const previewRegion: Region = {
            ...region,
            vertices: gripPreview.next.vertices,
            // Make preview semi-transparent and different color to show it's temporary
            opacity: 0.5,
            color: '#00ff00' // Green for grip preview
          };
          if (DEBUG_CANVAS_CORE) console.log('🎨 [OverlayRenderer] Drawing grip preview for region:', region.id, 'with', gripPreview.next.vertices.length, 'vertices');
          this.drawingEngine.drawRegion(previewRegion, transform, enhancedOptions, canvasHeight);
        } else {
          // Normal rendering
          this.drawingEngine.drawRegion(region, transform, enhancedOptions, canvasHeight);
        }
      }
    }
    
    // === DRAWING PREVIEW με GRIP SETTINGS ===
    if (options.isDrawing && options.drawingVertices && options.drawingStatus) {
      this.drawingEngine.drawDrawingPreview(
        options.drawingVertices,
        options.drawingStatus,
        transform,
        canvasHeight,
        options.mousePosition,
        gripSettings // === PASS GRIP SETTINGS ===
      );
    }
  }

  // === MISSING METHODS FOR COMPATIBILITY ===
  initialize(): void {
    // Initialize renderer
  }

  dispose(): void {
    // Clean up resources
  }

  updateTransform(transform: ViewTransform): void {
    // Update transform
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  drawHoverOverlay(entity: any, transform: ViewTransform): void {
    // Draw hover overlay
  }

  clearHover(): void {
    // Clear hover effects
  }

  drawDragPreview(entity: any, transform: ViewTransform): void {
    // Draw drag preview
  }

  clearDragPreview(): void {
    // Clear drag preview
  }

  clearAll(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // === LEGACY COMPATIBILITY (διατηρείται για backward compatibility) ===
  renderOverlay_OLD(regions: Region[], transform: ViewTransform): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const canvasRect = this.canvas.getBoundingClientRect();

    for (const region of regions) {
      if (region.visible) {
        this.drawRegion(region, transform, canvasRect);
      }
    }
  }

  private drawRegion(region: Region, transform: ViewTransform, canvasRect: DOMRect): void {
    // Use unified coordinate system
    const screenPoints = region.vertices.map(worldPoint => 
      coordTransforms.worldToScreen(worldPoint, transform, canvasRect)
    );
    
    // Basic region drawing (legacy)
    const ctx = this.ctx;
    ctx.save();
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    screenPoints.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // === UTILITY METHODS ===
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  screenToWorld(point: Point2D, transform: ViewTransform): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    return coordTransforms.screenToWorld(point, transform, rect);
  }
}
