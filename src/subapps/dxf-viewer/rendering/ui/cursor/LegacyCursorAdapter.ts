/**
 * LEGACY CURSOR ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old CursorRenderer
 */

import type { Point2D, Viewport, ViewTransform } from '../../types/Types';
import type { UICursorSettings } from './CursorTypes';
import type { CursorSettings as SystemCursorSettings } from '../../../systems/cursor/config';
import { CursorRenderer } from './CursorRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../core/UIRenderContext';
import type { UITransform } from '../core/UIRenderer';
import { UI_COLORS } from '../../../config/color-config';
// 🏢 ADR-034: Centralized Rendering Z-Index
import { RENDERING_ZINDEX } from '../../../config/tolerance-config';

/**
 * 🔺 LEGACY ADAPTER
 * Προσαρμογέας που εξομοιώνει την παλιά CursorRenderer interface
 * Αυτό επιτρέπει στο LayerRenderer να συνεχίσει να δουλεύει
 * χωρίς αλλαγές while internally χρησιμοποιώντας το νέο unified system
 */
export class LegacyCursorAdapter {
  private coreRenderer: CursorRenderer;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.coreRenderer = new CursorRenderer();
  }

  /**
   * Legacy render method - accepts optional transform parameter
   * ✅ FIX: Now accepts actual transform instead of always using DEFAULT_UI_TRANSFORM
   * ✅ ADAPTED για CursorSettings από systems/cursor/config.ts (nested structure)
   */
  render(
    position: Point2D,
    viewport: Viewport,
    settings: SystemCursorSettings,
    transform?: ViewTransform
  ): void {
    // Convert legacy nested SystemCursorSettings to flat UICursorSettings
    const flatSettings: UICursorSettings = {
      enabled: settings.cursor.enabled,
      visible: true,
      opacity: settings.cursor.opacity,
      color: settings.cursor.color,
      size: settings.cursor.size,
      lineWidth: settings.cursor.line_width,
      shape: this.mapShape(settings.cursor.shape),
      style: this.mapLineStyle(settings.cursor.line_style),
      showFill: false, // Legacy cursor doesn't support fill
      fillColor: UI_COLORS.WHITE,
      fillOpacity: 0.1,
      zIndex: RENDERING_ZINDEX.CURSOR  // 🏢 ADR-034: Centralized z-index (800)
    };

    // ✅ FIX: Convert ViewTransform to UITransform
    const uiTransform: UITransform = transform ? {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotation: 0
    } : DEFAULT_UI_TRANSFORM;

    // Convert legacy call to new UIRenderer interface με actual transform
    // 🎯 TYPE-SAFE CONTEXT EXTENSION: Use UIRenderContextWithMouse
    const baseContext = createUIRenderContext(
      this.ctx,
      viewport,
      uiTransform
    );

    const uiContext: import('../core/UIRenderer').UIRenderContextWithMouse = {
      ...baseContext,
      mousePosition: position
    };

    this.coreRenderer.render(uiContext, viewport, flatSettings);
  }

  /**
   * Map legacy shape types to new CursorShape enum
   */
  private mapShape(legacyShape: 'circle' | 'square'): 'circle' | 'square' | 'diamond' | 'cross' {
    switch (legacyShape) {
      case 'circle': return 'circle';
      case 'square': return 'square';
      default: return 'square';
    }
  }

  /**
   * Map legacy line style to new CursorLineStyle enum
   */
  private mapLineStyle(legacyStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot'): 'solid' | 'dashed' | 'dotted' | 'dash-dot' {
    return legacyStyle; // Same types, direct mapping
  }

  /**
   * Cleanup method for consistency
   */
  cleanup(): void {
    this.coreRenderer.cleanup();
  }
}