/**
 * UI RENDER CONTEXT - Implementation του UIRenderContext
 * ✅ ΦΑΣΗ 6: UI-specific rendering context με coordinate systems
 */

import type { Viewport } from '../../types/Types';
import type {
  UIRenderContext,
  UITransform
} from './UIRenderer';

/**
 * 🔺 UI RENDER CONTEXT IMPLEMENTATION
 * Concrete implementation του UIRenderContext interface
 */
export class UIRenderContextImpl implements UIRenderContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: UITransform;
  readonly timestamp: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    transform: UITransform
  ) {
    this.ctx = ctx;
    this.transform = transform;
    this.timestamp = performance.now();
  }

  /**
   * Update transform για animations/interactions
   */
  withTransform(transform: UITransform): UIRenderContextImpl {
    return new UIRenderContextImpl(this.ctx, transform);
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
  return new UIRenderContextImpl(ctx, transform);
}