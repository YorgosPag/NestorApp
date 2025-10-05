/**
 * LEGACY GRID ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old Grid rendering
 */

import type { Viewport } from '../../types/Types';
import type { GridSettings } from './GridTypes';
import type { GridSettings as LayerGridSettings } from '../../../canvas-v2/layer-canvas/layer-types';
import { GridRenderer } from './GridRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../core/UIRenderContext';

/**
 * 🔺 LEGACY ADAPTER
 * Προσαρμογέας που εξομοιώνει την παλιά Grid rendering interface
 * Αυτό επιτρέπει στο LayerRenderer να συνεχίσει να δουλεύει
 * χωρίς αλλαγές while internally χρησιμοποιώντας το νέο unified system
 */
export class LegacyGridAdapter {
  private coreRenderer: GridRenderer;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.coreRenderer = new GridRenderer();
  }

  /**
   * Legacy render method - maintains exact same interface as LayerRenderer
   */
  render(
    transform: { scale: number; offsetX: number; offsetY: number },
    viewport: Viewport,
    settings: LayerGridSettings
  ): void {
    // Convert legacy LayerGridSettings to GridSettings
    const flatSettings: GridSettings = {
      enabled: settings.enabled,
      visible: true,
      opacity: settings.opacity,
      color: settings.color,
      size: settings.size,
      style: settings.style,
      lineWidth: 1,

      // Enhanced features (using defaults)
      majorGridColor: this.darkenColor(settings.color, 0.2),
      minorGridColor: this.lightenColor(settings.color, 0.2),
      majorInterval: 5,
      showMajorGrid: true,
      showMinorGrid: true,
      adaptiveOpacity: true,
      minVisibleSize: 5,

      zIndex: 100
    };

    // Use direct render method for better performance
    this.coreRenderer.renderDirect(
      this.ctx,
      viewport,
      flatSettings,
      transform,
      'normal'
    );
  }

  /**
   * Helper: Darken a color by a factor
   */
  private darkenColor(color: string, factor: number): string {
    // Simple color darkening - can be enhanced later
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const newR = Math.max(0, Math.floor(r * (1 - factor)));
      const newG = Math.max(0, Math.floor(g * (1 - factor)));
      const newB = Math.max(0, Math.floor(b * (1 - factor)));

      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
    return color;
  }

  /**
   * Helper: Lighten a color by a factor
   */
  private lightenColor(color: string, factor: number): string {
    // Simple color lightening - can be enhanced later
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
      const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
      const newB = Math.min(255, Math.floor(b + (255 - b) * factor));

      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
    return color;
  }

  /**
   * Cleanup method for consistency
   */
  cleanup(): void {
    this.coreRenderer.cleanup();
  }
}