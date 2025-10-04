/**
 * LEGACY CROSSHAIR ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old CrosshairRenderer
 */

import type { Point2D, Viewport } from '../../types/Types';
import type { CrosshairSettings } from './CrosshairTypes';
import { CrosshairRenderer } from './CrosshairRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../core/UIRenderContext';

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
   * Legacy render method - maintains exact same interface
   */
  render(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings
  ): void {
    // Convert legacy call to new UIRenderer interface
    const uiContext = createUIRenderContext(
      this.ctx,
      viewport,
      DEFAULT_UI_TRANSFORM
    );

    // Add position to context (for crosshair position)
    (uiContext as any).mousePosition = position;

    this.coreRenderer.render(uiContext, viewport, settings);
  }

  /**
   * Legacy renderWithGap method - maintains exact same interface
   */
  renderWithGap(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    gapSize?: number
  ): void {
    // Extend settings με gap information
    const gapSettings = {
      ...settings,
      useCursorGap: true,
      centerGapPx: gapSize ?? 10
    };

    // Convert legacy call to new UIRenderer interface με 'with-gap' mode
    const uiContext = createUIRenderContext(
      this.ctx,
      viewport,
      DEFAULT_UI_TRANSFORM
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