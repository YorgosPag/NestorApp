/**
 * Text Entity Renderer
 * Handles rendering of text and mtext entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { TextEntity } from '../../types/entities';
import { HoverManager } from '../../utils/hover';
import { UI_COLORS } from '../../config/color-config';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

// ENTERPRISE: Import centralized text rendering configuration
import {
  TEXT_SIZE_LIMITS,
  CHARACTER_METRICS,
  TEXT_FONTS,
  calculateEffectiveScreenHeight,
  estimateTextWidth,
  buildCanvasFont
} from '../../config/text-rendering-config';

export class TextRenderer extends BaseEntityRenderer {
  /**
   * 🏢 ENTERPRISE: CAD-Standard Text Rendering
   *
   * Follows AutoCAD/BricsCAD text rendering specifications:
   * - Uses fontSize property (DXF code 40) for text height
   * - Supports alignment (DXF code 72): left, center, right
   * - Supports fontFamily for custom fonts
   * - Supports rotation (DXF code 50)
   *
   * @param entity - Text or MText entity to render
   * @param options - Render options (hover, selection, etc.)
   */
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'text' && entity.type !== 'mtext') return;

    // ✅ ENTERPRISE: Type guards for safe property access
    if (!('position' in entity) || !('text' in entity)) return;
    const position = entity.position as Point2D;
    const text = entity.text as string;

    // 🏢 ENTERPRISE FIX: Use fontSize (canonical) with fallback to height for backward compatibility
    // Priority: fontSize → height → default 2.5 (CAD standard default text height)
    const textHeight = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;
    const alignment = this.extractAlignment(entity);
    const fontFamily = ('fontFamily' in entity) ? entity.fontFamily as string : 'Arial';

    if (!position || !text) return;

    // Setup style
    this.setupStyle(entity, options);

    if (options.hovered) {
      // 🏢 ENTERPRISE: Use centralized hover manager with proper type assertion
      // We've already verified entity.type is 'text' or 'mtext' at the start of this method
      HoverManager.renderHover(entity as TextEntity, this.ctx, options, this.worldToScreen.bind(this));
    } else {
      // 🏢 ENTERPRISE: CAD-accurate text rendering
      const screenPos = this.worldToScreen(position);

      // 🏢 ENTERPRISE: Get viewport height for annotation scaling
      const rect = this.ctx.canvas.getBoundingClientRect();
      const viewportHeight = rect.height;

      // 🏢 ENTERPRISE: Annotation Scaling - text renders larger and proportional to viewport
      const effectiveScreenHeight = calculateEffectiveScreenHeight(textHeight, this.transform.scale, viewportHeight);

      this.ctx.save();

      // 🏢 ENTERPRISE: Apply text properties with CAD-standard font construction
      this.ctx.font = buildCanvasFont(effectiveScreenHeight, fontFamily);
      this.ctx.fillStyle = ('color' in entity ? entity.color : undefined) || UI_COLORS.DEFAULT_ENTITY;
      this.ctx.textAlign = alignment;
      this.ctx.textBaseline = 'bottom';

      // Apply rotation if needed (CAD rotation: counterclockwise from X-axis)
      if (rotation !== 0) {
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate((rotation * Math.PI) / 180);
        renderStyledTextWithOverride(this.ctx, text, 0, 0);
      } else {
        renderStyledTextWithOverride(this.ctx, text, screenPos.x, screenPos.y);
      }

      this.ctx.restore();
    }

    // Use centralized finalization
    this.finalizeRendering(entity, options);
  }

  /**
   * 🏢 ENTERPRISE: Extract text height with proper fallback chain
   *
   * Priority order (CAD standard):
   * 1. fontSize (canonical property from TextEntity interface)
   * 2. height (legacy/mtext property)
   * 3. DEFAULT_HEIGHT from centralized config (2.5 drawing units)
   *
   * @see text-rendering-config.ts - TEXT_SIZE_LIMITS.DEFAULT_HEIGHT
   */
  private extractTextHeight(entity: EntityModel): number {
    // Priority 1: fontSize (canonical)
    if ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > TEXT_SIZE_LIMITS.MIN_VALID_HEIGHT) {
      return entity.fontSize;
    }
    // Priority 2: height (legacy/backward compatibility)
    if ('height' in entity && typeof entity.height === 'number' && entity.height > TEXT_SIZE_LIMITS.MIN_VALID_HEIGHT) {
      return entity.height as number;
    }
    // Default: CAD standard default text height from centralized config
    return TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;
  }

  /**
   * 🏢 ENTERPRISE: Extract text alignment with proper type conversion
   *
   * Maps DXF horizontal alignment (code 72) to CanvasTextAlign:
   * - 0 = Left (default)
   * - 1 = Center
   * - 2 = Right
   */
  private extractAlignment(entity: EntityModel): CanvasTextAlign {
    if ('alignment' in entity) {
      const align = entity.alignment as string;
      if (align === 'center') return 'center';
      if (align === 'right') return 'right';
    }
    return 'left';
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'text' && entity.type !== 'mtext') return [];

    const grips: GripInfo[] = [];
    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('position' in entity)) return [];
    const position = entity.position as Point2D;
    
    if (!position) return grips;
    
    // Position grip
    grips.push({
      id: `${entity.id}-position`,
      entityId: entity.id,
      type: 'vertex',
      gripIndex: 0,
      position: position,
      isVisible: true,
      isHovered: false,
      isSelected: false,
      gripType: 'vertex' // ✅ ENTERPRISE FIX: Backward compatibility alias
    });
    
    return grips;
  }

  /**
   * 🏢 ENTERPRISE: CAD-Standard Text Hit Testing
   *
   * Uses accurate bounding box calculation based on:
   * - Text height from fontSize property
   * - Alignment for proper X offset
   * - Character width estimation (0.6 × height for proportional fonts)
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = 5): boolean {
    if (entity.type !== 'text' && entity.type !== 'mtext') return false;

    // ✅ ENTERPRISE: Type guard for safe property access
    if (!('position' in entity) || !('text' in entity)) return false;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    const textHeight = this.extractTextHeight(entity);
    const alignment = this.extractAlignment(entity);

    if (!position || !text) return false;

    // 🏢 ENTERPRISE: CAD-accurate hit testing with alignment support
    const screenPos = this.worldToScreen(position);
    const screenPoint = this.worldToScreen(point);
    const screenHeight = textHeight * this.transform.scale;

    // 🏢 ENTERPRISE: Use centralized character metrics for width estimation
    const estimatedWidth = estimateTextWidth(text, screenHeight);

    // 🏢 ENTERPRISE: Calculate X offset based on alignment
    let xOffset = 0;
    if (alignment === 'center') {
      xOffset = -estimatedWidth / 2;
    } else if (alignment === 'right') {
      xOffset = -estimatedWidth;
    }

    // Check if point is within text bounding box
    const dx = screenPoint.x - (screenPos.x + xOffset);
    const dy = screenPoint.y - screenPos.y;

    return dx >= -tolerance &&
           dx <= estimatedWidth + tolerance &&
           dy >= -screenHeight - tolerance &&
           dy <= tolerance;
  }
}