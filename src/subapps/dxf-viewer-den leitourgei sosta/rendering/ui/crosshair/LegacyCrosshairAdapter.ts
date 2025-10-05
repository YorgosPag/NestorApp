/**
 * LEGACY CROSSHAIR ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old CrosshairRenderer
 */

import type { Point2D, Viewport, ViewTransform } from '../../types/Types';
import type { CrosshairSettings } from './CrosshairTypes';
import { CrosshairRenderer } from './CrosshairRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../core/UIRenderContext';
import type { UITransform } from '../core/UIRenderer';

/**
 * 🔺 LEGACY ADAPTER
 * Προσαρμογέας που εξομοιώνει την παλιά CrosshairRenderer interface
 * Αυτό επιτρέπει στα DxfCanvas και LayerRenderer να συνεχίσουν να δουλεύουν
 * χωρίς αλλαγές while internally χρησιμοποιώντας το νέο unified system
 */
export class LegacyCrosshairAdapter {
  private coreRenderer: CrosshairRenderer;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.coreRenderer = new CrosshairRenderer();
  }

  /**
   * Legacy render method - accepts optional transform parameter
   * ✅ FIX: Now accepts actual transform instead of always using DEFAULT_UI_TRANSFORM
   */
  render(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    transform?: ViewTransform
  ): void {
    // ✅ FIX: Convert ViewTransform to UITransform
    const uiTransform: UITransform = transform ? {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotation: 0
    } : DEFAULT_UI_TRANSFORM;

    // Convert legacy call to new UIRenderer interface με actual transform
    const uiContext = createUIRenderContext(
      this.ctx,
      viewport,
      uiTransform
    );

    // Add position to context (for crosshair position)
    (uiContext as any).mousePosition = position;

    this.coreRenderer.render(uiContext, viewport, settings);
  }

  /**
   * Legacy renderWithGap method - accepts optional transform parameter
   * ✅ FIX: Now accepts actual transform instead of always using DEFAULT_UI_TRANSFORM
   */
  renderWithGap(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    gapSize?: number,
    transform?: ViewTransform
  ): void {
    // Extend settings με gap information
    const gapSettings = {
      ...settings,
      useCursorGap: true,
      centerGapPx: gapSize ?? 10
    };

    // ✅ FIX: Convert ViewTransform to UITransform
    const uiTransform: UITransform = transform ? {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotation: 0
    } : DEFAULT_UI_TRANSFORM;

    // Convert legacy call to new UIRenderer interface με actual transform
    const uiContext = createUIRenderContext(
      this.ctx,
      viewport,
      uiTransform
    );

    // Add position to context
    (uiContext as any).mousePosition = position;

    this.coreRenderer.renderDirect(
      this.ctx,
      position,
      viewport,
      gapSettings,
      'with-gap'
    );
  }

  /**
   * Cleanup method for consistency
   */
  cleanup(): void {
    this.coreRenderer.cleanup();
  }
}