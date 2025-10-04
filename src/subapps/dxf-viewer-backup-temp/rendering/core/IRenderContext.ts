/**
 * IRENDERCONTEXT - Abstraction για διαφορετικά rendering backends
 * ✅ ΦΑΣΗ 4: Προετοιμασία για Canvas2D/WebGL/WebGPU support
 */

export interface RenderState {
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineDash: number[];
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

export interface Transform2D {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number;
}

// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: Χρήση unified Viewport από types/Types.ts
import type { Point2D, Viewport } from '../types/Types';

// Re-export unified types για backwards compatibility
export type { Point2D, Viewport } from '../types/Types';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 🔺 ΚΕΝΤΡΙΚΗ ΑΦΑΙΡΕΣΗ RENDERING
 * Επιτρέπει εναλλαγή μεταξύ Canvas2D, WebGL, WebGPU χωρίς αλλαγές στον κώδικα
 */
export interface IRenderContext {
  // ===== BACKEND INFO =====
  readonly type: 'canvas2d' | 'webgl' | 'webgpu';
  readonly canvas: HTMLCanvasElement;
  readonly isHardwareAccelerated: boolean;

  // ===== CANVAS MANAGEMENT =====
  clear(): void;
  resize(width: number, height: number): void;
  getSize(): { width: number; height: number };

  // ===== STATE MANAGEMENT =====
  save(): void;
  restore(): void;
  getState(): RenderState;
  setState(state: Partial<RenderState>): void;

  // ===== TRANSFORMS =====
  setTransform(transform: Transform2D): void;
  resetTransform(): void;
  worldToScreen(worldPoint: Point2D): Point2D;
  screenToWorld(screenPoint: Point2D): Point2D;

  // ===== BASIC DRAWING =====
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterClockwise?: boolean): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterClockwise?: boolean): void;
  rect(x: number, y: number, width: number, height: number): void;

  // ===== ADVANCED PATHS =====
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;

  // ===== RENDERING =====
  stroke(): void;
  fill(): void;
  clip(): void;

  // ===== TEXT RENDERING =====
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): TextMetrics;

  // ===== ADVANCED FEATURES =====
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;

  // ===== PATH2D SUPPORT (για caching) =====
  createPath2D(): Path2D | null;
  drawPath(path: Path2D | null): void;

  // ===== HIT TESTING =====
  isPointInPath(x: number, y: number): boolean;
  isPointInStroke(x: number, y: number): boolean;

  // ===== PERFORMANCE & BATCHING =====
  startBatch?(): void;
  endBatch?(): void;
  flushBatch?(): void;

  // ===== DEBUGGING =====
  getPerformanceMetrics?(): {
    drawCalls: number;
    vertexCount: number;
    textureBinds: number;
    bufferUpdates: number;
  };

  // ===== LIFECYCLE =====
  dispose(): void;
}

/**
 * 🔺 RENDER CONTEXT FACTORY
 * Δημιουργεί το κατάλληλο context βάσει του backend type
 */
export interface IRenderContextFactory {
  createContext(canvas: HTMLCanvasElement, type: 'canvas2d' | 'webgl' | 'webgpu'): Promise<IRenderContext>;
  getSupportedTypes(): ('canvas2d' | 'webgl' | 'webgpu')[];
  getBestAvailableType(): 'canvas2d' | 'webgl' | 'webgpu';
}

/**
 * 🔺 RENDER CONTEXT OPTIONS
 * Configuration για διαφορετικά backends
 */
export interface RenderContextOptions {
  antialias?: boolean;
  alpha?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  failIfMajorPerformanceCaveat?: boolean;
  // WebGL specific
  webgl?: {
    version?: 1 | 2;
    extensions?: string[];
  };
  // WebGPU specific
  webgpu?: {
    requiredFeatures?: string[];
    requiredLimits?: Record<string, number>;
  };
}

/**
 * 🔺 ERROR TYPES
 * Για καλύτερο error handling
 */
export class RenderContextError extends Error {
  constructor(
    message: string,
    public readonly contextType: string,
    public readonly cause?: Error
  ) {
    super(`RenderContext[${contextType}]: ${message}`);
    this.name = 'RenderContextError';
  }
}

export class UnsupportedBackendError extends RenderContextError {
  constructor(requestedType: string, supportedTypes: string[]) {
    super(
      `Backend '${requestedType}' not supported. Available: ${supportedTypes.join(', ')}`,
      requestedType
    );
    this.name = 'UnsupportedBackendError';
  }
}