/**
 * CANVAS2D CONTEXT - Implementation του IRenderContext για Canvas2D
 * ✅ ΦΑΣΗ 4: Wrapper που παρέχει batching και optimization
 */

import type {
  IRenderContext,
  RenderState,
  Transform2D
} from '../../core/IRenderContext';
import type { Point2D } from '../../types/Types';

/**
 * 🔺 CANVAS2D RENDER CONTEXT
 * Τυλίγει το native Canvas2D API με επιπλέον features:
 * - Batching optimization
 * - Performance tracking
 * - Path2D caching
 * - State management
 */
export class Canvas2DContext implements IRenderContext {
  readonly type = 'canvas2d' as const;
  readonly canvas: HTMLCanvasElement;
  readonly isHardwareAccelerated = false;

  private ctx: CanvasRenderingContext2D;
  private currentTransform: Transform2D = { scale: 1, offsetX: 0, offsetY: 0 };
  private stateStack: RenderState[] = [];

  // Performance tracking
  private metrics = {
    drawCalls: 0,
    vertexCount: 0,
    textureBinds: 0,
    bufferUpdates: 0
  };

  // Batching support
  private batchingEnabled = false;
  private batchedOperations: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }

  // ===== CANVAS MANAGEMENT =====
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.metrics.drawCalls++;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    // Reapply current transform after resize
    this.setTransform(this.currentTransform);
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  // ===== STATE MANAGEMENT =====
  save(): void {
    const currentState: RenderState = {
      strokeStyle: this.ctx.strokeStyle as string,
      fillStyle: this.ctx.fillStyle as string,
      lineWidth: this.ctx.lineWidth,
      lineDash: this.ctx.getLineDash(),
      globalAlpha: this.ctx.globalAlpha,
      font: this.ctx.font,
      textAlign: this.ctx.textAlign,
      textBaseline: this.ctx.textBaseline
    };
    this.stateStack.push(currentState);
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
    if (this.stateStack.length > 0) {
      this.stateStack.pop();
    }
  }

  getState(): RenderState {
    return {
      strokeStyle: this.ctx.strokeStyle as string,
      fillStyle: this.ctx.fillStyle as string,
      lineWidth: this.ctx.lineWidth,
      lineDash: this.ctx.getLineDash(),
      globalAlpha: this.ctx.globalAlpha,
      font: this.ctx.font,
      textAlign: this.ctx.textAlign,
      textBaseline: this.ctx.textBaseline
    };
  }

  setState(state: Partial<RenderState>): void {
    if (state.strokeStyle !== undefined) this.ctx.strokeStyle = state.strokeStyle;
    if (state.fillStyle !== undefined) this.ctx.fillStyle = state.fillStyle;
    if (state.lineWidth !== undefined) this.ctx.lineWidth = state.lineWidth;
    if (state.lineDash !== undefined) this.ctx.setLineDash(state.lineDash);
    if (state.globalAlpha !== undefined) this.ctx.globalAlpha = state.globalAlpha;
    if (state.font !== undefined) this.ctx.font = state.font;
    if (state.textAlign !== undefined) this.ctx.textAlign = state.textAlign;
    if (state.textBaseline !== undefined) this.ctx.textBaseline = state.textBaseline;
  }

  // ===== TRANSFORMS =====
  setTransform(transform: Transform2D): void {
    this.currentTransform = { ...transform };
    this.ctx.setTransform(
      transform.scale,
      0,
      0,
      transform.scale,
      transform.offsetX,
      transform.offsetY
    );
    if (transform.rotation) {
      this.ctx.rotate(transform.rotation);
    }
  }

  resetTransform(): void {
    this.ctx.resetTransform();
    this.currentTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  }

  worldToScreen(worldPoint: Point2D): Point2D {
    const { scale, offsetX, offsetY } = this.currentTransform;
    return {
      x: worldPoint.x * scale + offsetX,
      y: worldPoint.y * scale + offsetY
    };
  }

  screenToWorld(screenPoint: Point2D): Point2D {
    const { scale, offsetX, offsetY } = this.currentTransform;
    return {
      x: (screenPoint.x - offsetX) / scale,
      y: (screenPoint.y - offsetY) / scale
    };
  }

  // ===== BASIC DRAWING =====
  beginPath(): void {
    this.executeOrBatch(() => this.ctx.beginPath());
  }

  closePath(): void {
    this.executeOrBatch(() => this.ctx.closePath());
  }

  moveTo(x: number, y: number): void {
    this.executeOrBatch(() => this.ctx.moveTo(x, y));
    this.metrics.vertexCount++;
  }

  lineTo(x: number, y: number): void {
    this.executeOrBatch(() => this.ctx.lineTo(x, y));
    this.metrics.vertexCount++;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterClockwise?: boolean): void {
    this.executeOrBatch(() => this.ctx.arc(x, y, radius, startAngle, endAngle, counterClockwise));
    this.metrics.vertexCount += 8; // Approximate vertex count for arc
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterClockwise?: boolean): void {
    this.executeOrBatch(() => this.ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterClockwise));
    this.metrics.vertexCount += 12; // Approximate vertex count for ellipse
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.executeOrBatch(() => this.ctx.rect(x, y, width, height));
    this.metrics.vertexCount += 4;
  }

  // ===== ADVANCED PATHS =====
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.executeOrBatch(() => this.ctx.quadraticCurveTo(cpx, cpy, x, y));
    this.metrics.vertexCount += 3;
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.executeOrBatch(() => this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y));
    this.metrics.vertexCount += 4;
  }

  // ===== RENDERING =====
  stroke(): void {
    this.executeOrBatch(() => this.ctx.stroke());
    this.metrics.drawCalls++;
  }

  fill(): void {
    this.executeOrBatch(() => this.ctx.fill());
    this.metrics.drawCalls++;
  }

  clip(): void {
    this.executeOrBatch(() => this.ctx.clip());
  }

  // ===== TEXT RENDERING =====
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.executeOrBatch(() => this.ctx.fillText(text, x, y, maxWidth));
    this.metrics.drawCalls++;
  }

  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.executeOrBatch(() => this.ctx.strokeText(text, x, y, maxWidth));
    this.metrics.drawCalls++;
  }

  measureText(text: string): TextMetrics {
    return this.ctx.measureText(text);
  }

  // ===== ADVANCED FEATURES =====
  drawImage(image: CanvasImageSource, ...args: number[]): void {
    this.executeOrBatch(() => {
      if (args.length === 2) {
        this.ctx.drawImage(image, args[0], args[1]);
      } else if (args.length === 4) {
        this.ctx.drawImage(image, args[0], args[1], args[2], args[3]);
      } else if (args.length === 8) {
        this.ctx.drawImage(image, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]);
      }
    });
    this.metrics.drawCalls++;
    this.metrics.textureBinds++;
  }

  // ===== PATH2D SUPPORT =====
  createPath2D(): Path2D | null {
    try {
      return new Path2D();
    } catch {
      return null; // Fallback for environments without Path2D support
    }
  }

  drawPath(path: Path2D | null): void {
    if (path) {
      this.executeOrBatch(() => this.ctx.stroke(path));
      this.metrics.drawCalls++;
    }
  }

  // ===== HIT TESTING =====
  isPointInPath(x: number, y: number): boolean {
    return this.ctx.isPointInPath(x, y);
  }

  isPointInStroke(x: number, y: number): boolean {
    return this.ctx.isPointInStroke(x, y);
  }

  // ===== PERFORMANCE & BATCHING =====
  startBatch(): void {
    this.batchingEnabled = true;
    this.batchedOperations = [];
  }

  endBatch(): void {
    this.flushBatch();
    this.batchingEnabled = false;
  }

  flushBatch(): void {
    if (this.batchedOperations.length > 0) {
      // Execute all batched operations at once
      this.batchedOperations.forEach(operation => operation());
      this.batchedOperations = [];
      this.metrics.bufferUpdates++;
    }
  }

  private executeOrBatch(operation: () => void): void {
    if (this.batchingEnabled) {
      this.batchedOperations.push(operation);
    } else {
      operation();
    }
  }

  // ===== DEBUGGING =====
  getPerformanceMetrics() {
    return { ...this.metrics };
  }

  // ===== LIFECYCLE =====
  dispose(): void {
    this.flushBatch();
    this.stateStack = [];
    this.batchedOperations = [];
    // Canvas cleanup is handled by browser
  }
}

/**
 * 🔺 FACTORY FUNCTION
 * Δημιουργεί Canvas2DContext με proper error handling
 */
export function createCanvas2DContext(canvas: HTMLCanvasElement): Canvas2DContext {
  try {
    return new Canvas2DContext(canvas);
  } catch (error) {
    throw new Error(`Failed to create Canvas2D context: ${error}`);
  }
}