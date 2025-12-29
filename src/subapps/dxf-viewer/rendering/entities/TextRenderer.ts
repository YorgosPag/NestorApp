/**
 * Text Entity Renderer
 * Handles rendering of text and mtext entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { Entity, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { HoverManager } from '../../utils/hover';
import { UI_COLORS } from '../../config/color-config';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class TextRenderer extends BaseEntityRenderer {
  render(entity: Entity, options: RenderOptions = {}): void {
    if (entity.type !== 'text' && entity.type !== 'mtext') return;

    // ✅ ENTERPRISE FIX: Use type guards for safe property access
    if (!('position' in entity) || !('text' in entity)) return;
    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = ('height' in entity) ? entity.height as number : 12;
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;
    
    if (!position || !text) return;
    
    // Setup style
    this.setupStyle(entity, options);
    
    if (options.hovered) {
      // Use centralized hover manager
      HoverManager.renderHover(entity, this.ctx, options, this.worldToScreen.bind(this));
    } else {
      // Normal text rendering
      const screenPos = this.worldToScreen(position);
      const screenHeight = height * this.transform.scale;
      
      this.ctx.save();
      
      // Apply text properties
      this.ctx.font = `${screenHeight}px Arial`;
      this.ctx.fillStyle = ('color' in entity ? entity.color : undefined) || UI_COLORS.DEFAULT_ENTITY;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'bottom';
      
      // Apply rotation if needed
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

  getGrips(entity: Entity): GripInfo[] {
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

}