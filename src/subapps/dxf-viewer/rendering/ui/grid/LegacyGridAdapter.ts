/**
 * LEGACY GRID ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old Grid rendering
 */

import type { Viewport } from '../../types/Types';
import type { GridSettings } from './GridTypes';
import type { GridSettings as LayerGridSettings } from '../../../canvas-v2/layer-canvas/layer-types';
import { GridRenderer } from './GridRenderer';
// 🏢 ADR-076: Centralized Color Conversion
import { parseHex, rgbToHex } from '../../../ui/color/utils';
// 🏢 ADR-034: Centralized Rendering Z-Index
import { RENDERING_ZINDEX } from '../../../config/tolerance-config';
// 🏢 SSoT: Axis/origin defaults — single source of truth
import { GRID_AXES_DEFAULTS } from '../../../config/grid-axis-defaults';

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
      majorGridWeight: 2,
      minorGridWeight: 1,

      // 🏢 ORIGIN & AXES: fallback to SSoT — config/grid-axis-defaults.ts
      showOrigin: settings.showOrigin ?? GRID_AXES_DEFAULTS.showOrigin,
      showAxes: settings.showAxes ?? GRID_AXES_DEFAULTS.showAxes,
      axesColor: settings.axesColor ?? GRID_AXES_DEFAULTS.axesColor,
      axesWeight: settings.axesWeight ?? GRID_AXES_DEFAULTS.axesWeight,

      zIndex: RENDERING_ZINDEX.GRID  // 🏢 ADR-034: Centralized z-index (10)
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
   * 🏢 ADR-076: Uses centralized color conversion
   */
  private darkenColor(color: string, factor: number): string {
    if (color.startsWith('#')) {
      try {
        const rgb = parseHex(color);
        const newR = Math.max(0, Math.floor(rgb.r * (1 - factor)));
        const newG = Math.max(0, Math.floor(rgb.g * (1 - factor)));
        const newB = Math.max(0, Math.floor(rgb.b * (1 - factor)));
        return rgbToHex({ r: newR, g: newG, b: newB });
      } catch {
        return color;
      }
    }
    return color;
  }

  /**
   * Helper: Lighten a color by a factor
   * 🏢 ADR-076: Uses centralized color conversion
   */
  private lightenColor(color: string, factor: number): string {
    if (color.startsWith('#')) {
      try {
        const rgb = parseHex(color);
        const newR = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * factor));
        const newG = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * factor));
        const newB = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * factor));
        return rgbToHex({ r: newR, g: newG, b: newB });
      } catch {
        return color;
      }
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