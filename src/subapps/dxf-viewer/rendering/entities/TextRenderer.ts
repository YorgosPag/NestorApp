/**
 * Text Entity Renderer
 * Handles rendering of text and mtext entities
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  ΠΡΟΣΟΧΗ - ΜΗΝ ΑΛΛΑΞΕΤΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ! ⚠️                          ║
 * ║                                                                          ║
 * ║  Αυτός ο κώδικας ΛΕΙΤΟΥΡΓΕΙ ΣΩΣΤΑ μετά από πολλές δοκιμές.              ║
 * ║                                                                          ║
 * ║  ✅ VERIFIED WORKING: 2026-01-03                                         ║
 * ║  ✅ Τα κείμενα εμφανίζονται με σωστό μέγεθος και χρώμα                   ║
 * ║  ✅ Βασισμένο στο working backup (08-09-2025)                            ║
 * ║                                                                          ║
 * ║  ΚΡΙΣΙΜΟ: Η απλή προσέγγιση (height × scale) είναι η ΣΩΣΤΗ!             ║
 * ║  ΜΗΝ προσθέσετε:                                                         ║
 * ║  - SCALE_BOOST_FACTOR                                                    ║
 * ║  - calculateEffectiveScreenHeight()                                      ║
 * ║  - Annotation scaling                                                    ║
 * ║  - Dynamic minimums                                                      ║
 * ║                                                                          ║
 * ║  Αυτά ΧΑΛΑΣΑΝ τη λειτουργικότητα στο παρελθόν!                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { TextEntity } from '../../types/entities';
import { HoverManager } from '../../utils/hover';
import { UI_COLORS } from '../../config/color-config';


export class TextRenderer extends BaseEntityRenderer {
  /**
   * Text Rendering - Simplified approach from working backup
   *
   * Uses direct height × scale calculation for proper text sizing
   */
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'text' && entity.type !== 'mtext') return;

    // Type guards for safe property access
    if (!('position' in entity) || !('text' in entity)) return;
    const position = entity.position as Point2D;
    const text = entity.text as string;

    // ✅ SIMPLIFIED: Extract height with fallback to 12 (like old backup)
    const height = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;

    if (!position || !text) return;

    // Setup style
    this.setupStyle(entity, options);

    if (options.hovered) {
      HoverManager.renderHover(entity as TextEntity, this.ctx, options, this.worldToScreen.bind(this));
    } else {
      // ✅ SIMPLIFIED: Direct calculation like old backup
      const screenPos = this.worldToScreen(position);
      const screenHeight = height * this.transform.scale;

      this.ctx.save();

      // ✅ SIMPLIFIED: Direct font setting
      this.ctx.font = `${screenHeight}px Arial`;
      this.ctx.fillStyle = ('color' in entity ? entity.color : undefined) || UI_COLORS.DEFAULT_ENTITY;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'bottom';

      // Apply rotation if needed
      if (rotation !== 0) {
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate((rotation * Math.PI) / 180);
        this.ctx.fillText(text, 0, 0);
      } else {
        this.ctx.fillText(text, screenPos.x, screenPos.y);
      }

      this.ctx.restore();
    }

    // Use centralized finalization
    this.finalizeRendering(entity, options);
  }

  /**
   * Extract text height with fallback
   * Priority: height → fontSize → default 12 (like old backup)
   */
  private extractTextHeight(entity: EntityModel): number {
    // Priority 1: height (direct from entity)
    if ('height' in entity && typeof entity.height === 'number' && entity.height > 0.1) {
      return entity.height as number;
    }
    // Priority 2: fontSize (alternative property name)
    if ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0.1) {
      return entity.fontSize;
    }
    // Default: 12 (like old backup, not 2.5)
    return 12;
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
   * Hit testing for text entities (simplified like old backup)
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = 5): boolean {
    if (entity.type !== 'text' && entity.type !== 'mtext') return false;

    if (!('position' in entity) || !('text' in entity)) return false;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = this.extractTextHeight(entity);

    if (!position || !text) return false;

    // ✅ SIMPLIFIED: Approximate text bounds like old backup
    const width = text.length * height * 0.6; // Rough approximation

    // Check if point is within text bounds (world coordinates)
    const minX = position.x;
    const maxX = position.x + width;
    const minY = position.y - height;
    const maxY = position.y;

    const worldTolerance = tolerance / this.transform.scale;

    return point.x >= minX - worldTolerance &&
           point.x <= maxX + worldTolerance &&
           point.y >= minY - worldTolerance &&
           point.y <= maxY + worldTolerance;
  }
}