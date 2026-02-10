/**
 * LEGACY SNAP ADAPTER - Backwards compatibility
 * ✅ ΦΑΣΗ 6: Adapter pattern για smooth transition από old SnapRenderer
 */

import type { Viewport, ViewTransform } from '../../types/Types';
import type { SnapSettings, SnapResult } from './SnapTypes';
import type { SnapSettings as LayerSnapSettings, SnapResult as LayerSnapResult } from '../../../canvas-v2/layer-canvas/layer-types';
import { SnapRenderer } from './SnapRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../core/UIRenderContext';
import { UI_COLORS } from '../../../config/color-config';
// 🏢 ADR-153: Centralized Snap Tooltip Offset
// 🏢 ADR-034: Centralized Rendering Z-Index
import { SNAP_TOOLTIP_OFFSET, RENDERING_ZINDEX } from '../../../config/tolerance-config';
import type { UITransform } from '../core/UIRenderer';

/**
 * 🔺 LEGACY ADAPTER
 * Προσαρμογέας που εξομοιώνει την παλιά SnapRenderer interface
 * Αυτό επιτρέπει στο LayerRenderer να συνεχίσει να δουλεύει
 * χωρίς αλλαγές while internally χρησιμοποιώντας το νέο unified system
 */
export class LegacySnapAdapter {
  private coreRenderer: SnapRenderer;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.coreRenderer = new SnapRenderer();
  }

  /**
   * Legacy render method - accepts optional transform parameter
   * ✅ FIX: Now accepts actual transform instead of always using DEFAULT_UI_TRANSFORM
   */
  render(
    snapResults: LayerSnapResult[],
    viewport: Viewport,
    settings: LayerSnapSettings,
    transform?: ViewTransform
  ): void {
    // Convert legacy LayerSnapSettings to SnapSettings
    const flatSettings: SnapSettings = {
      enabled: settings.enabled,
      visible: true,
      opacity: 0.9,
      color: UI_COLORS.SNAP_DEFAULT,
      size: 8,
      lineWidth: 2,
      tolerance: settings.tolerance,

      // Type-specific colors (using defaults)
      endpointColor: UI_COLORS.SNAP_ENDPOINT,
      midpointColor: UI_COLORS.SNAP_MIDPOINT,
      centerColor: UI_COLORS.SNAP_CENTER,
      intersectionColor: UI_COLORS.SNAP_INTERSECTION,

      // Visual feedback
      showTooltip: true,
      tooltipOffset: SNAP_TOOLTIP_OFFSET,  // 🏢 ADR-153: Centralized snap tooltip offset
      highlightColor: UI_COLORS.SNAP_HIGHLIGHT,
      zIndex: RENDERING_ZINDEX.SNAP  // 🏢 ADR-034: Centralized z-index (900)
    };

    // Convert legacy LayerSnapResult to SnapResult
    // 🎯 TYPE-SAFE: LayerSnapResult may have optional distance property
    const convertedSnapResults: SnapResult[] = snapResults.map(snap => {
      const snapWithDistance = snap as typeof snap & { distance?: number };
      return {
        point: snap.point,
        type: snap.type,
        distance: snapWithDistance.distance || 0, // LayerSnapResult doesn't have distance, use 0 as default
        entityId: snap.entityId,
        priority: this.getSnapPriority(snap.type)
      };
    });

    // ✅ FIX: Convert ViewTransform to UITransform
    const uiTransform: UITransform = transform ? {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotation: 0
    } : DEFAULT_UI_TRANSFORM;

    // Convert legacy call to new UIRenderer interface με actual transform
    // 🎯 TYPE-SAFE CONTEXT EXTENSION: Use UIRenderContextWithSnap
    const baseContext = createUIRenderContext(
      this.ctx,
      viewport,
      uiTransform
    );

    const uiContext: import('../core/UIRenderer').UIRenderContextWithSnap = {
      ...baseContext,
      snapData: convertedSnapResults
    };

    this.coreRenderer.render(uiContext, viewport, flatSettings);
  }

  /**
   * Get priority για snap type (higher = more important)
   */
  private getSnapPriority(type: string): number {
    switch (type) {
      case 'endpoint': return 10;
      case 'midpoint': return 8;
      case 'center': return 7;
      case 'intersection': return 9;
      case 'perpendicular': return 6;
      case 'parallel': return 5;
      case 'tangent': return 4;
      case 'quadrant': return 3;
      case 'nearest': return 2;
      case 'grid': return 1;
      default: return 1;
    }
  }

  /**
   * Cleanup method for consistency
   */
  cleanup(): void {
    this.coreRenderer.cleanup();
  }
}