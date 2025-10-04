/**
 * Text Entity Renderer
 * Handles rendering of text and mtext entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { HoverManager } from '../../utils/hover';
import { UI_COLORS } from '../../config/color-config';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class TextRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'text' && entity.type !== 'mtext') return;
    
    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = entity.height as number || 12;
    const rotation = entity.rotation as number || 0;
    
    if (!position || !text) return;
    
    // Setup style
    this.setupStyle(entity, options);
    
    if (options.hovered) {
      // Use centralized hover manager
      HoverManager.renderHover(entity, this.ctx, options, this.worldToScreen.bind(this));
    } else {
      // Normal text rendering
      const screenPos = this.worldToScreen(position);

      // 🔧 CRITICAL FIX: DXF text height calculation
      // BUG WAS: renderStyledTextWithOverride() ignores our screenHeight and uses textStyleStore.fontSize!
      // SOLUTION: Use ctx.fillText() directly with DXF entity height
      const screenHeight = height * this.transform.scale;

      // 🐛 DEBUG: Log text height values
      if (Math.random() < 0.05) {  // Log 5% of texts to avoid spam
        console.log(`📝 TEXT: "${text.substring(0, 20)}", DXF height=${height}, scale=${this.transform.scale.toFixed(2)}, screenHeight=${screenHeight.toFixed(1)}px`);
      }

      this.ctx.save();

      // Apply text properties - USE DXF ENTITY HEIGHT, NOT GLOBAL SETTINGS!
      this.ctx.font = `${screenHeight}px Arial`;
      this.ctx.fillStyle = entity.color || UI_COLORS.DEFAULT_ENTITY;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'bottom';

      // Apply rotation if needed
      if (rotation !== 0) {
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate((rotation * Math.PI) / 180);
        // 🔧 FIX: Use ctx.fillText directly, NOT renderStyledTextWithOverride
        this.ctx.fillText(text, 0, 0);
      } else {
        // 🔧 FIX: Use ctx.fillText directly, NOT renderStyledTextWithOverride
        this.ctx.fillText(text, screenPos.x, screenPos.y);
      }

      this.ctx.restore();
    }
    
    // Use centralized finalization
    this.finalizeRendering(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'text' && entity.type !== 'mtext') return [];
    
    const grips: GripInfo[] = [];
    const position = entity.position as Point2D;
    
    if (!position) return grips;
    
    // Position grip
    grips.push({
      entityId: entity.id,
      gripType: 'vertex',
      gripIndex: 0,
      position: position,
      state: 'cold'
    });
    
    return grips;
  }

}