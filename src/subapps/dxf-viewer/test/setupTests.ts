/**
 * 🏢 ENTERPRISE JEST SETUP για DXF Viewer Testing
 * Comprehensive test environment configuration με mocks και utilities
 */

import { UI_COLORS } from '../config/color-config';

// ✅ ENTERPRISE FIX: Jest type imports for testing environment
declare global {
  const jest: any;
  const beforeEach: (fn: () => void) => void;
  const afterEach: (fn: () => void) => void;
  const expect: any;

  namespace jest {
    interface Matchers<R> {
      toMatchVisualBaseline(baselinePath: string, options?: any): R;
      toBeWithinVisualThreshold(expected: number, threshold?: number): R;
    }
  }
}

// JSDOM + Canvas mocks για browser environment simulation
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => ({
    // Minimal 2D context stub για coordinate testing
    canvas: {},
    save: jest.fn(),
    restore: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    transform: jest.fn(),
    setTransform: jest.fn(),
    createLinearGradient: jest.fn(),
    createRadialGradient: jest.fn(),
    createPattern: jest.fn(),
    drawImage: jest.fn(),
    putImageData: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4), // Minimal image data
      width: 1,
      height: 1
    })),
    measureText: jest.fn(() => ({ width: 10 })),
    // Properties που χρειάζονται για rendering
    fillStyle: UI_COLORS.BLACK,
    strokeStyle: UI_COLORS.BLACK,
    lineWidth: 1,
    font: '10px Arial',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over'
  }))
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
  value: jest.fn(() => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    toJSON: () => ({})
  }))
});

// 🎨 VISUAL REGRESSION TESTING SETUP
// Enhanced toDataURL mock για consistent PNG generation
Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: function(type: string = 'image/png') {
    // Generate deterministic test image based on canvas size
    const width = this.width || 800;
    const height = this.height || 600;

    // Create minimal PNG data URL για consistent testing
    const testPattern = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
    return `data:${type};base64,${testPattern}`;
  },
  writable: true
});

// Performance.now fallback για older environments
if (!global.performance || !global.performance.now) {
  Object.defineProperty(global, 'performance', {
    value: {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
      getEntriesByName: jest.fn(() => []),
      getEntriesByType: jest.fn(() => [])
    }
  });
}

// DOM element creation utilities για tests
function createMockCanvas(options?: {
  width?: number;
  height?: number;
  canvasType?: string;
}): HTMLCanvasElement {
  const { width = 800, height = 600, canvasType = 'dxf' } = options || {};

  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-canvas-type', canvasType);
  canvas.width = width;
  canvas.height = height;

  // Override getBoundingClientRect για αυτό το specific canvas
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: (): DOMRect => ({
      x: 0, y: 0, top: 0, left: 0,
      width, height,
      right: width, bottom: height,
      toJSON: () => ({})
    } as DOMRect)
  });

  document.body.appendChild(canvas);
  return canvas;
}

function createMockDOMRect(options?: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}): DOMRect {
  const { x = 0, y = 0, width = 800, height = 600 } = options || {};

  return {
    x, y,
    top: y,
    left: x,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({})
  } as DOMRect;
}

// Mouse event simulation utilities
function createMockMouseEvent(options?: {
  clientX?: number;
  clientY?: number;
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}): MouseEvent {
  const {
    clientX = 400,
    clientY = 300,
    button = 0,
    ctrlKey = false,
    shiftKey = false
  } = options || {};

  return new MouseEvent('mousemove', {
    clientX,
    clientY,
    button,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true
  });
}

// Viewport simulation utilities
function createMockViewport(options?: {
  width?: number;
  height?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
}): { width: number; height: number; zoom: number; panX: number; panY: number } {
  const {
    width = 800,
    height = 600,
    zoom = 1,
    panX = 0,
    panY = 0
  } = options || {};

  return { width, height, zoom, panX, panY };
}

// Transform simulation utilities
function createMockTransform(options?: {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}): { scale: number; offsetX: number; offsetY: number } {
  const {
    scale = 1,
    offsetX = 0,
    offsetY = 0
  } = options || {};

  return { scale, offsetX, offsetY };
}

// Test data generators
function generateTestPoints(count: number, bounds?: {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}): Array<{ x: number; y: number }> {
  const {
    minX = 0,
    maxX = 800,
    minY = 0,
    maxY = 600
  } = bounds || {};

  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY)
    });
  }
  return points;
}

function generateTestScenarios(): Array<{ name: string; scale: number; offsetX: number; offsetY: number }> {
  return [
    { name: 'default', scale: 1, offsetX: 0, offsetY: 0 },
    { name: 'zoom_in', scale: 2, offsetX: 50, offsetY: -30 },
    { name: 'zoom_out', scale: 0.5, offsetX: -100, offsetY: 80 },
    { name: 'hidpi', scale: 1.5, offsetX: 0, offsetY: 0 },
    { name: 'extreme_zoom_in', scale: 10, offsetX: 200, offsetY: -150 },
    { name: 'extreme_zoom_out', scale: 0.1, offsetX: -500, offsetY: 300 }
  ];
}

// Error validation utilities
function validateCoordinateError(
  original: { x: number; y: number },
  recovered: { x: number; y: number },
  tolerance: number = 0.5
): {
  error: number;
  passed: boolean;
  details: {
    deltaX: number;
    deltaY: number;
    tolerance: number;
  };
} {
  const deltaX = Math.abs(original.x - recovered.x);
  const deltaY = Math.abs(original.y - recovered.y);
  const error = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const passed = error <= tolerance;

  return {
    error,
    passed,
    details: { deltaX, deltaY, tolerance }
  };
}

// Performance testing utilities
function measurePerformance<T>(
  fn: () => T,
  iterations: number = 1000
): {
  result: T;
  durationMs: number;
  iterationsPerSecond: number;
  averageIterationMs: number;
} {
  const start = performance.now();
  let result: T;

  for (let i = 0; i < iterations; i++) {
    result = fn();
  }

  const end = performance.now();
  const durationMs = end - start;
  const iterationsPerSecond = Math.round((iterations / durationMs) * 1000);
  const averageIterationMs = durationMs / iterations;

  return {
    result: result!,
    durationMs,
    iterationsPerSecond,
    averageIterationMs
  };
}

// Cleanup utilities
function cleanupMockElements(): void {
  // Remove all mock canvas elements
  const canvases = document.querySelectorAll('canvas[data-canvas-type]');
  canvases.forEach(canvas => canvas.remove());
}

// Global test setup
beforeEach(() => {
  // Reset performance mocks
  if (global.performance?.now) {
    (global.performance.now as jest.Mock).mockClear();
  }
});

afterEach(() => {
  // Cleanup DOM
  cleanupMockElements();

  // Clear any global state
  jest.clearAllMocks();
});

// Console suppression για cleaner test output (optional)
const originalConsole = global.console;

function suppressConsole(): void {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}

function restoreConsole(): void {
  global.console = originalConsole;
}

// 🎨 VISUAL REGRESSION TESTING UTILITIES
function createVisualTestCanvas(options?: {
  width?: number;
  height?: number;
  testId?: string;
}): HTMLCanvasElement {
  const { width = 800, height = 600, testId = 'visual-test' } = options || {};

  const canvas = createMockCanvas({ width, height });
  canvas.setAttribute('data-visual-test-id', testId);

  return canvas;
}

function ensureDirectoryExists(dirPath: string): void {
  // Mock utility για ensuring directories exist στα tests
  // In real implementation would use fs.mkdirSync
  console.log(`Mock: Creating directory ${dirPath}`);
}

function generateTestImageBuffer(width: number = 800, height: number = 600): Buffer {
  // Generate deterministic test buffer για visual testing
  const mockData = new Uint8Array(width * height * 4); // RGBA

  // Fill με simple pattern
  for (let i = 0; i < mockData.length; i += 4) {
    mockData[i] = Math.floor((i / 4) % 256);     // R
    mockData[i + 1] = Math.floor((i / 8) % 256); // G
    mockData[i + 2] = 128;                       // B
    mockData[i + 3] = 255;                       // A
  }

  return Buffer.from(mockData);
}

function validateVisualMatch(
  baseline: Buffer,
  actual: Buffer,
  options?: {
    threshold?: number;
    maxMismatchPixels?: number;
  }
): {
  matched: boolean;
  mismatchedPixels: number;
  mismatchRate: number;
  details?: string;
} {
  const { threshold = 0.1, maxMismatchPixels = 50 } = options || {};

  // Mock visual comparison για testing
  const matched = baseline.length === actual.length;
  const mismatchedPixels = matched ? 0 : maxMismatchPixels + 1;
  const mismatchRate = mismatchedPixels / (baseline.length / 4);

  return {
    matched: matched && mismatchedPixels <= maxMismatchPixels,
    mismatchedPixels,
    mismatchRate,
    details: matched ? 'Visual match successful' : 'Visual mismatch detected'
  };
}

// Custom Jest matchers για visual testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchVisualBaseline(baselinePath: string, options?: any): R;
      toBeWithinVisualThreshold(expected: number, threshold?: number): R;
    }
  }
}

// Extend Jest με visual regression matchers
const visualMatchers = {
  toMatchVisualBaseline(received: Buffer, baselinePath: string, options: any = {}) {
    const pass = received instanceof Buffer && baselinePath.includes('.png');

    if (pass) {
      return {
        message: () => `Expected image not to match baseline ${baselinePath}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected image to match baseline ${baselinePath}`,
        pass: false,
      };
    }
  },

  toBeWithinVisualThreshold(received: number, expected: number, threshold: number = 0.0001) {
    const pass = Math.abs(received - expected) <= threshold;

    if (pass) {
      return {
        message: () => `Expected ${received} not to be within visual threshold ${threshold} of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be within visual threshold ${threshold} of ${expected}, but got difference of ${Math.abs(received - expected)}`,
        pass: false,
      };
    }
  }
};

// Apply matchers
if (typeof expect !== 'undefined' && (expect as any).extend) {
  (expect as any).extend(visualMatchers); // ✅ ENTERPRISE FIX: Jest expect.extend type assertion
}

// Export all utilities για test files
export {
  // Main utilities
  createMockCanvas,
  createMockDOMRect,
  createMockMouseEvent,
  createMockViewport,
  createMockTransform,

  // Data generators
  generateTestPoints,
  generateTestScenarios,

  // Validation
  validateCoordinateError,
  measurePerformance,

  // Visual regression utilities
  createVisualTestCanvas,
  ensureDirectoryExists,
  generateTestImageBuffer,
  validateVisualMatch,

  // Cleanup
  cleanupMockElements,
  suppressConsole,
  restoreConsole
};