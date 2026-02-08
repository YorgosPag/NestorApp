/**
 * 🎨 ENTERPRISE CANVAS BACKEND για Visual Regression Testing
 * Real canvas rendering με @napi-rs/canvas για deterministic PNG output
 * Αντικαθιστά το mock canvas context με πραγματικό rendering
 */

import { createCanvas, GlobalFonts, Image } from '@napi-rs/canvas';
import type { Canvas, SKRSContext2D } from '@napi-rs/canvas';
import { UI_COLORS } from '../config/color-config';
// 🏢 ADR-XXX: Centralized viewport defaults
import { VIEWPORT_DEFAULTS } from '../config/transform-config';

type CanvasMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif' | 'image/gif';

// 🎯 DETERMINISTIC FONT SETUP
// Load fixed fonts για consistent text rendering
try {
  // Register μια σταθερή font για deterministic text rendering
  // Θα χρησιμοποιήσουμε system fallbacks αν δεν βρούμε custom fonts
  console.log('🎨 Setting up deterministic canvas backend...');
} catch (error) {
  console.warn('⚠️ Font loading warning:', error);
}

// 🖼️ ENHANCED HTMLCANVASELEMENT MOCK
// Replace του JSDOM canvas με πραγματικό @napi-rs/canvas
declare global {
  interface HTMLCanvasElement {
    __napiCanvas?: Canvas;
    __napiContext?: SKRSContext2D;
  }
}

/**
 * 🎨 REAL CANVAS CONTEXT SETUP
 * Αντικαθιστά το mock getContext με πραγματικό rendering
 */
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: function(this: HTMLCanvasElement, contextType: string) {
    if (contextType === '2d') {
      // Create real napi-rs canvas αν δεν υπάρχει
      if (!this.__napiCanvas) {
        const width = this.width || VIEWPORT_DEFAULTS.WIDTH;
        const height = this.height || VIEWPORT_DEFAULTS.HEIGHT;

        this.__napiCanvas = createCanvas(width, height);
        this.__napiContext = this.__napiCanvas.getContext('2d');

        // 🎯 DETERMINISTIC RENDERING SETTINGS
        const ctx = this.__napiContext;

        // Fixed text rendering settings
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = '12px monospace'; // Fixed font για consistency

        // Fixed line rendering settings
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 10;

        // Disable anti-aliasing για pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;

        // Fixed DPR (Device Pixel Ratio)
        // Simulate standard 1x DPR για consistency
        ctx.scale(1, 1);
      }

      return this.__napiContext;
    }

    return null;
  },
  writable: true
});

/**
 * 🖼️ REAL PNG GENERATION
 * Αντικαθιστά το mock toDataURL με πραγματικό PNG output
 */
Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: function(this: HTMLCanvasElement, type: string = 'image/png') {
    if (this.__napiCanvas) {
      // Generate πραγματικό PNG από το napi canvas
      const buffer = this.__napiCanvas.toBuffer('image/png');
      const base64 = buffer.toString('base64');
      return `data:${type};base64,${base64}`;
    }

    // Fallback για cases όπου δεν έχουμε napi canvas
    console.warn('⚠️ toDataURL called without napi canvas - generating empty PNG');
    const width = this.width || VIEWPORT_DEFAULTS.WIDTH;
    const height = this.height || VIEWPORT_DEFAULTS.HEIGHT;
    const fallbackCanvas = createCanvas(width, height);
    const buffer = fallbackCanvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');
    return `data:${type};base64,${base64}`;
  },
  writable: true
});

/**
 * 🖼️ DIRECT BUFFER ACCESS
 * Helper method για direct PNG buffer access
 */
Object.defineProperty(HTMLCanvasElement.prototype, 'toBuffer', {
  value: function(this: HTMLCanvasElement, mimeType: CanvasMimeType = 'image/png') {
    if (this.__napiCanvas) {
      // @napi-rs/canvas toBuffer accepts specific mime types
      return this.__napiCanvas.toBuffer(mimeType as 'image/png');
    }

    // Fallback
    const width = this.width || VIEWPORT_DEFAULTS.WIDTH;
    const height = this.height || VIEWPORT_DEFAULTS.HEIGHT;
    const fallbackCanvas = createCanvas(width, height);
    return fallbackCanvas.toBuffer(mimeType as 'image/png');
  },
  writable: true
});

/**
 * 🎯 ENHANCED CANVAS CREATION UTILITY
 * Creates canvas με deterministic settings
 */
export function createDeterministicCanvas(
  width: number = VIEWPORT_DEFAULTS.WIDTH,
  height: number = VIEWPORT_DEFAULTS.HEIGHT,
  options?: {
    pixelRatio?: number;
    antialias?: boolean;
    textBaseline?: CanvasTextBaseline;
    font?: string;
  }
): HTMLCanvasElement {
  const {
    pixelRatio = 1,
    antialias = false,
    textBaseline = 'top',
    font = '12px monospace'
  } = options || {};

  const canvas = document.createElement('canvas');
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  // Force creation του napi canvas
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Apply deterministic settings
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = antialias;
    ctx.textBaseline = textBaseline;
    ctx.font = font;

    // Clear με consistent background
    ctx.fillStyle = UI_COLORS.WHITE;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = UI_COLORS.BLACK; // Reset to black
  }

  return canvas;
}

/**
 * 🔧 CANVAS DIMENSION SYNC
 * Ensures napi canvas dimensions match HTMLCanvas dimensions
 */
function syncCanvasDimensions(canvas: HTMLCanvasElement) {
  if (canvas.__napiCanvas) {
    const width = canvas.width || VIEWPORT_DEFAULTS.WIDTH;
    const height = canvas.height || VIEWPORT_DEFAULTS.HEIGHT;

    // Recreate αν τα dimensions άλλαξαν
    if (canvas.__napiCanvas.width !== width || canvas.__napiCanvas.height !== height) {
      canvas.__napiCanvas = createCanvas(width, height);
      canvas.__napiContext = canvas.__napiCanvas.getContext('2d');
    }
  }
}

// 📐 OVERRIDE WIDTH/HEIGHT SETTERS
// Sync dimensions όταν αλλάζουν
const originalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
const originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
  get: originalWidthDescriptor?.get,
  set: function(value: number) {
    if (originalWidthDescriptor?.set) {
      originalWidthDescriptor.set.call(this, value);
    }
    syncCanvasDimensions(this);
  },
  configurable: true
});

Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
  get: originalHeightDescriptor?.get,
  set: function(value: number) {
    if (originalHeightDescriptor?.set) {
      originalHeightDescriptor.set.call(this, value);
    }
    syncCanvasDimensions(this);
  },
  configurable: true
});

/**
 * 🧪 CANVAS TESTING UTILITIES
 */
export const CanvasTestUtils = {
  /**
   * Create test canvas με specific settings
   */
  createTestCanvas: createDeterministicCanvas,

  /**
   * Validate ότι το canvas έχει πραγματικό content
   */
  hasRealContent: (canvas: HTMLCanvasElement): boolean => {
    if (!canvas.__napiCanvas) return false;

    const buffer = canvas.__napiCanvas.toBuffer('image/png');
    return buffer.length > 1000; // Non-empty PNG should be > 1KB
  },

  /**
   * Get PNG buffer directly
   */
  toPngBuffer: (canvas: HTMLCanvasElement): Buffer => {
    if (canvas.__napiCanvas) {
      return canvas.__napiCanvas.toBuffer('image/png');
    }
    throw new Error('Canvas has no napi backend');
  },

  /**
   * Clear canvas με deterministic background
   */
  clearCanvas: (canvas: HTMLCanvasElement, fillColor: string = UI_COLORS.WHITE) => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
};

// 🎯 GLOBAL SETUP COMPLETION
console.log('✅ Enterprise canvas backend initialized with @napi-rs/canvas');

export { createCanvas, GlobalFonts, Image };
export type { Canvas, SKRSContext2D };
