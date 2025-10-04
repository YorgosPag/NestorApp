/**
 * UI RENDER CONTEXT - Implementation του UIRenderContext
 * ✅ ΦΑΣΗ 6: UI-specific rendering context με coordinate systems
 */

import type { Point2D, Viewport } from '../../types/Types';
import type {
  UIRenderContext,
  UICoordinateSystem,
  UITransform
} from './UIRenderer';

/**
 * 🔺 CONCRETE UI COORDINATE SYSTEM
 * Handles screen-space coordinates για UI elements
 */
export class ScreenUICoordinateSystem implements UICoordinateSystem {
  private viewport: Viewport;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
  }

  /**
   * Screen coordinates είναι ήδη UI coordinates
   */
  screenToUI(point: Point2D): Point2D {
    return { x: point.x, y: point.y };
  }

  /**
   * UI coordinates είναι ήδη screen coordinates
   */
  uiToScreen(point: Point2D): Point2D {
    return { x: point.x, y: point.y };
  }

  /**
   * Scale values για UI elements (pixel-based)
   */
  scaleToUI(value: number): number {
    return value;
  }

  /**
   * Scale από UI σε screen (1:1 mapping)
   */
  scaleToScreen(value: number): number {
    return value;
  }

  /**
   * Update viewport για coordinate calculations
   */
  updateViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }
}

/**
 * 🔺 UI RENDER CONTEXT IMPLEMENTATION
 * Concrete implementation του UIRenderContext interface
 */
export class UIRenderContextImpl implements UIRenderContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: UITransform;
  readonly coordinates: UICoordinateSystem;
  readonly timestamp: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    transform: UITransform,
    viewport: Viewport
  ) {
    this.ctx = ctx;
    this.transform = transform;
    this.coordinates = new ScreenUICoordinateSystem(viewport);
    this.timestamp = performance.now();
  }

  /**
   * Update transform για animations/interactions
   */
  withTransform(transform: UITransform): UIRenderContextImpl {
    return new UIRenderContextImpl(
      this.ctx,
      transform,
      { width: 0, height: 0 } // Will be updated by coordinates system
    );
  }
}

/**
 * 🔺 DEFAULT UI TRANSFORM
 * Identity transform για UI elements
 */
export const DEFAULT_UI_TRANSFORM: UITransform = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  rotation: 0
};

/**
 * 🔺 UI RENDER CONTEXT FACTORY
 * Convenience function για δημιουργία UI context
 */
export function createUIRenderContext(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  transform: UITransform = DEFAULT_UI_TRANSFORM
): UIRenderContext {
  return new UIRenderContextImpl(ctx, transform, viewport);
}