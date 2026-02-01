/**
 * CANVAS UTILITIES - Centralized canvas utilities
 * ✅ ΦΑΣΗ 7: Μετακίνηση από canvas-v2/shared/utils.ts
 * 🏢 ENTERPRISE (2026-01-27): Uses CanvasBoundsService for cached getBoundingClientRect
 */

import type { CanvasConfig, Point2D } from '../../types/Types';
// 🏢 ENTERPRISE: Centralized bounds service για performance optimization
import { canvasBoundsService } from '../../../services/CanvasBoundsService';
// 🏢 ADR-094: Centralized Device Pixel Ratio
// 🏢 ADR-117: DPI-Aware Pixel Calculations Centralization
import { getDevicePixelRatio, toDevicePixels } from '../../../systems/cursor/utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { ZERO_VECTOR } from '../../../config/geometry-constants';

// ✅ ENTERPRISE: Vendor-specific canvas context properties for HiDPI support
interface VendorCanvasRenderingContext2D extends CanvasRenderingContext2D {
  webkitBackingStorePixelRatio?: number;
  mozBackingStorePixelRatio?: number;
  msBackingStorePixelRatio?: number;
  oBackingStorePixelRatio?: number;
  backingStorePixelRatio?: number;
}


/**
 * 🔺 CENTRALIZED CANVAS UTILITIES
 * Αντικαθιστά το canvas-v2/shared/utils.ts
 * Provides unified canvas utility functions για όλα τα canvas instances
 */
export class CanvasUtils {
  /**
   * Setup canvas με proper DPI scaling
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static setupCanvasContext(
    canvas: HTMLCanvasElement,
    config: CanvasConfig
  ): CanvasRenderingContext2D {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      throw new Error('Invalid canvas element provided');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const dpr = config.enableHiDPI ? (config.devicePixelRatio || getDevicePixelRatio()) : 1; // 🏢 ADR-094
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);

    // ✅ DON'T OVERRIDE CSS SIZE - respect existing CSS
    // Only set backing store size for HiDPI

    // Backing store size
    // 🏢 ADR-117: Use centralized toDevicePixels for DPI-aware calculations
    canvas.width = toDevicePixels(rect.width, dpr);
    canvas.height = toDevicePixels(rect.height, dpr);

    // Scale context
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = config.imageSmoothingEnabled !== false;

    return ctx;
  }

  /**
   * Καθαρισμός canvas με σωστή διάσταση (CSS dimensions, όχι backing store)
   * 🔧 FIXED: Use logical dimensions, not physical backing store dimensions
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static clearCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    backgroundColor = 'transparent'
  ): void {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.clearCanvas: Invalid canvas element provided');
      return;
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;

    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    } else {
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    }
  }

  /**
   * Get canvas logical dimensions (CSS dimensions)
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static getCanvasDimensions(canvas: HTMLCanvasElement): { width: number; height: number } {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    // 🏢 ADR-118: Use centralized ZERO_VECTOR pattern for error fallback
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.getCanvasDimensions: Invalid canvas element provided');
      return { width: 0, height: 0 }; // Keeps { width, height } format, not Point2D
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    return {
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Get canvas physical dimensions (backing store)
   */
  static getCanvasPhysicalDimensions(canvas: HTMLCanvasElement): { width: number; height: number } {
    return {
      width: canvas.width,
      height: canvas.height
    };
  }

  /**
   * Get device pixel ratio για canvas
   */
  static getDevicePixelRatio(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 1;

    const dpr = getDevicePixelRatio(); // 🏢 ADR-094
    // ✅ ENTERPRISE: Type-safe access to vendor-specific properties
    const vendorCtx = ctx as VendorCanvasRenderingContext2D;
    const backingStoreRatio = vendorCtx.webkitBackingStorePixelRatio ||
                             vendorCtx.mozBackingStorePixelRatio ||
                             vendorCtx.msBackingStorePixelRatio ||
                             vendorCtx.oBackingStorePixelRatio ||
                             vendorCtx.backingStorePixelRatio || 1;

    return dpr / backingStoreRatio;
  }

  /**
   * Convert screen coordinates to canvas coordinates
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static screenToCanvas(
    point: Point2D,
    canvas: HTMLCanvasElement
  ): Point2D {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    // 🏢 ADR-118: Use centralized ZERO_VECTOR for error fallback
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.screenToCanvas: Invalid canvas element provided');
      return ZERO_VECTOR;
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    return {
      x: point.x - rect.left,
      y: point.y - rect.top
    };
  }

  /**
   * Convert canvas coordinates to screen coordinates
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static canvasToScreen(
    point: Point2D,
    canvas: HTMLCanvasElement
  ): Point2D {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    // 🏢 ADR-118: Use centralized ZERO_VECTOR for error fallback
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.canvasToScreen: Invalid canvas element provided');
      return ZERO_VECTOR;
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    return {
      x: point.x + rect.left,
      y: point.y + rect.top
    };
  }

  /**
   * Check if point is inside canvas bounds
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static isPointInCanvas(
    point: Point2D,
    canvas: HTMLCanvasElement
  ): boolean {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.isPointInCanvas: Invalid canvas element provided');
      return false;
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    const canvasPoint = this.screenToCanvas(point, canvas);

    return canvasPoint.x >= 0 &&
           canvasPoint.y >= 0 &&
           canvasPoint.x <= rect.width &&
           canvasPoint.y <= rect.height;
  }

  /**
   * Get canvas center point
   * 🏢 ENTERPRISE: Uses CanvasBoundsService for cached bounds
   */
  static getCanvasCenter(canvas: HTMLCanvasElement): Point2D {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    // 🏢 ADR-118: Use centralized ZERO_VECTOR for error fallback
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.getCanvasCenter: Invalid canvas element provided');
      return ZERO_VECTOR;
    }
    // 🏢 ENTERPRISE: Use cached bounds service
    const rect = canvasBoundsService.getBounds(canvas);
    return {
      x: rect.width / 2,
      y: rect.height / 2
    };
  }

  /**
   * Create canvas element με configuration
   */
  static createCanvas(
    config: CanvasConfig,
    className?: string
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    if (className) {
      canvas.className = className;
    }

    // Setup context
    this.setupCanvasContext(canvas, config);

    return canvas;
  }

  /**
   * Resize canvas maintaining aspect ratio
   * 🏢 ENTERPRISE: Invalidates cache after resize
   */
  static resizeCanvas(
    canvas: HTMLCanvasElement,
    newWidth: number,
    newHeight: number,
    config: CanvasConfig
  ): void {
    // ✅ SAFETY: Check if canvas is valid before proceeding
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
      console.error('CanvasUtils.resizeCanvas: Invalid canvas element provided');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Store current canvas content
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Update canvas size
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;

    // 🏢 ENTERPRISE: Invalidate cache after programmatic resize
    canvasBoundsService.clearCache(canvas);

    // Re-setup context with new dimensions
    this.setupCanvasContext(canvas, config);

    // Restore content if needed (optional)
    // ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Save canvas as image
   */
  static saveCanvasAsImage(
    canvas: HTMLCanvasElement,
    filename: string = 'canvas-export.png',
    format: 'png' | 'jpeg' | 'webp' = 'png',
    quality: number = 1.0
  ): void {
    const mimeType = `image/${format}`;
    const dataURL = canvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Get canvas content as blob
   */
  static async getCanvasBlob(
    canvas: HTMLCanvasElement,
    format: 'png' | 'jpeg' | 'webp' = 'png',
    quality: number = 1.0
  ): Promise<Blob | null> {
    return new Promise((resolve) => {
      const mimeType = `image/${format}`;
      canvas.toBlob(resolve, mimeType, quality);
    });
  }

  /**
   * Copy canvas content to another canvas
   */
  static copyCanvas(
    sourceCanvas: HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement
  ): void {
    const sourceCtx = sourceCanvas.getContext('2d');
    const targetCtx = targetCanvas.getContext('2d');

    if (!sourceCtx || !targetCtx) return;

    // Ensure target canvas has same dimensions
    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;

    // Copy content
    targetCtx.drawImage(sourceCanvas, 0, 0);
  }

  /**
   * Get canvas pixel data at point
   */
  static getPixelData(
    canvas: HTMLCanvasElement,
    point: Point2D
  ): Uint8ClampedArray | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      const imageData = ctx.getImageData(point.x, point.y, 1, 1);
      return imageData.data;
    } catch (error) {
      console.error('Error getting pixel data:', error);
      return null;
    }
  }

  /**
   * Check if canvas is blank/empty
   */
  static isCanvasBlank(canvas: HTMLCanvasElement): boolean {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check if all pixels are transparent
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false; // Alpha channel not zero
      }

      return true;
    } catch (error) {
      console.error('Error checking canvas blank state:', error);
      return false;
    }
  }

  /**
   * Apply performance optimizations
   */
  static optimizeCanvas(
    canvas: HTMLCanvasElement,
    options: {
      willReadFrequently?: boolean;
      alpha?: boolean;
      desynchronized?: boolean;
    } = {}
  ): CanvasRenderingContext2D | null {
    const contextOptions: CanvasRenderingContext2DSettings = {
      alpha: options.alpha !== false,
      desynchronized: options.desynchronized || false,
      willReadFrequently: options.willReadFrequently || false
    };

    return canvas.getContext('2d', contextOptions);
  }
}