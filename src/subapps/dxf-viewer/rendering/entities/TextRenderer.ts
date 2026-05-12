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
 * ║  ✅ Τα κείμενα κλιμακώνονται με το zoom (screenHeight = height × scale) ║
 * ║  ✅ Τα κείμενα διαστάσεων ακολουθούν τη σωστή κατεύθυνση (rotation)     ║
 * ║                                                                          ║
 * ║  ΚΡΙΣΙΜΟ: Η απλή προσέγγιση (height × scale) είναι η ΣΩΣΤΗ!             ║
 * ║  ΜΗΝ προσθέσετε:                                                         ║
 * ║  - SCALE_BOOST_FACTOR                                                    ║
 * ║  - MIN/MAX clamping (κάνει τα κείμενα σταθερά!)                         ║
 * ║  - Annotation scaling                                                    ║
 * ║                                                                          ║
 * ║  📐 ROTATION FIX (2026-01-03):                                           ║
 * ║  Το rotation για dimension text λειτουργεί ΣΩΣΤΑ!                        ║
 * ║  - DXF: Counter-clockwise (CCW), 0° = +X                                 ║
 * ║  - Canvas: Clockwise (CW) με Y-flip                                      ║
 * ║  - Λύση: Αντιστροφή γωνίας (-rotation) λόγω Y-flip                      ║
 * ║  ΜΗΝ ΑΛΛΑΞΕΤΕ τον υπολογισμό rotation!                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isTextEntity, isMTextEntity } from '../../types/entities';
import { UI_COLORS, HOVER_HIGHLIGHT } from '../../config/color-config';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './shared/geometry-utils';
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
// 🏢 ADR-107: Centralized Text Metrics Ratios
import { buildUIFont, TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';


// ADR-344 Phase 6.E: rich text style shape
type TextRichStyle = {
  bold?: boolean; italic?: boolean; fontFamily?: string;
  runColor?: string; textAlign?: 'left' | 'center' | 'right';
  textBaseline?: 'top' | 'middle' | 'bottom';
  underline?: boolean; overline?: boolean; strikethrough?: boolean;
} | undefined;

export class TextRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return;
    if (!('position' in entity) || !('text' in entity)) return;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    if (!position || !text) return;

    const height = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;
    const screenPos = this.worldToScreen(position);
    const screenHeight = height * this.transform.scale;
    const richStyle = this.extractRichStyle(entity);
    const fontFamily = richStyle?.fontFamily || 'arial';
    const weight: 'normal' | 'bold' = richStyle?.bold ? 'bold' : 'normal';
    const italic = richStyle?.italic;
    let normalizedRotation = rotation % 360;
    if (normalizedRotation < 0) normalizedRotation += 360;

    this.setupStyle(entity, options);
    this.renderTextContent(entity, text, screenPos, screenHeight, normalizedRotation, richStyle, fontFamily, weight, italic, options.hovered);
    this.finalizeRendering(entity, options);
  }

  private extractRichStyle(entity: EntityModel): TextRichStyle {
    if (!('textStyle' in entity)) return undefined;
    return entity.textStyle as TextRichStyle;
  }

  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ 🔧 DXF ROTATION FIX v3 (2026-01-03)                                   ║
  // ║ DXF: Counter-clockwise (CCW), 0° = +X                                 ║
  // ║ Canvas: Clockwise (CW) with Y-flip → negate angle                     ║
  // ║ DO NOT change the rotation calculation.                                ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  private renderTextContent(
    entity: EntityModel, text: string, screenPos: Point2D,
    screenHeight: number, normalizedRotation: number, richStyle: TextRichStyle,
    fontFamily: string, weight: 'normal' | 'bold', italic: boolean | undefined,
    isHovered = false
  ): void {
    const baseColor = ('color' in entity ? entity.color : undefined) as string | undefined;
    const textAlignMode = richStyle?.textAlign ?? 'left';
    // Y offsets relative to text origin, accounting for textBaseline.
    // baselineVOffset: 0=top, 0.5=middle, 1.0=bottom (fraction of screenHeight shift from 'top').
    const baselineVOffset = richStyle?.textBaseline === 'middle' ? 0.5 : richStyle?.textBaseline === 'bottom' ? 1.0 : 0;
    const underlineYOff   = screenHeight * ( 0.90 - baselineVOffset);
    const overlineYOff    = screenHeight * (-0.05 - baselineVOffset);
    const strikethroughYOff = screenHeight * (0.40 - baselineVOffset);
    const hasDecoration = richStyle?.underline || richStyle?.overline || richStyle?.strikethrough;

    this.ctx.save();
    this.ctx.font = buildUIFont(screenHeight, fontFamily, weight, italic);
    // Hover: turn text yellow (matches AutoCAD behaviour — entity turns yellow on hover).
    this.ctx.fillStyle = isHovered
      ? HOVER_HIGHLIGHT.ENTITY.glowColor
      : (richStyle?.runColor || baseColor || UI_COLORS.DEFAULT_ENTITY);
    this.ctx.textAlign = richStyle?.textAlign ?? 'left';
    // textBaseline from textNode.attachment[0]: T→top, M→middle, B→bottom. Default 'top' per DXF baseline fix.
    this.ctx.textBaseline = richStyle?.textBaseline ?? 'top';
    // Hover glow: shadowBlur creates visible halo even for sub-pixel text (SHX/unknown fonts).
    // GPU cost acceptable: single entity hover path, not all-entity 60fps render.
    if (isHovered) {
      this.ctx.shadowBlur = HOVER_HIGHLIGHT.TEXT.glowShadowBlur;
      this.ctx.shadowColor = HOVER_HIGHLIGHT.TEXT.glowColor;
    }

    if (normalizedRotation !== 0) {
      this.ctx.translate(screenPos.x, screenPos.y);
      this.ctx.rotate(degToRad(-normalizedRotation));
      this.ctx.fillText(text, 0, 0);
      if (hasDecoration) {
        const w = this.ctx.measureText(text).width;
        const thickness = Math.max(1, screenHeight * 0.07);
        const xOff = textAlignMode === 'center' ? -w / 2 : textAlignMode === 'right' ? -w : 0;
        if (richStyle?.underline)     this.ctx.fillRect(xOff, underlineYOff,    w, thickness);
        if (richStyle?.overline)      this.ctx.fillRect(xOff, overlineYOff,     w, thickness);
        if (richStyle?.strikethrough) this.ctx.fillRect(xOff, strikethroughYOff, w, thickness);
      }
    } else {
      this.ctx.fillText(text, screenPos.x, screenPos.y);
      if (hasDecoration) {
        const w = this.ctx.measureText(text).width;
        const thickness = Math.max(1, screenHeight * 0.07);
        const xOff = textAlignMode === 'center' ? -w / 2 : textAlignMode === 'right' ? -w : 0;
        if (richStyle?.underline)     this.ctx.fillRect(screenPos.x + xOff, screenPos.y + underlineYOff,     w, thickness);
        if (richStyle?.overline)      this.ctx.fillRect(screenPos.x + xOff, screenPos.y + overlineYOff,      w, thickness);
        if (richStyle?.strikethrough) this.ctx.fillRect(screenPos.x + xOff, screenPos.y + strikethroughYOff, w, thickness);
      }
    }
    this.ctx.restore();
  }

  /**
   * Extract text height with fallback
   * Priority: height → fontSize → default 2.5 (AutoCAD Standard DIMTXT)
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ 🏢 ENTERPRISE FIX (2026-01-03): Removed 0.1 threshold                    ║
   * ║                                                                          ║
   * ║ ΠΡΙΝ: height > 0.1 → fallback 12 (λάθος!)                               ║
   * ║ Αυτό έκανε dims με μικρό height (0.18) να πέφτουν σε 12 = ΤΕΡΑΣΤΙΑ!     ║
   * ║                                                                          ║
   * ║ ΤΩΡΑ: height > 0 → χρησιμοποιεί την πραγματική τιμή                     ║
   * ║ Fallback: 2.5 (AutoCAD Standard default, όχι arbitrary 12)              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   */
  private extractTextHeight(entity: EntityModel): number {
    // Priority 1: height (direct from entity - from DXF parsing)
    if ('height' in entity && typeof entity.height === 'number' && entity.height > 0) {
      return entity.height as number;
    }
    // Priority 2: fontSize (alternative property name)
    if ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0) {
      return entity.fontSize;
    }
    // Default: 2.5 (AutoCAD Standard DIMTXT default)
    return 2.5;
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return [];

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
   * 🏢 ADR-105: Use centralized fallback tolerance
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return false;

    if (!('position' in entity) || !('text' in entity)) return false;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;

    if (!position || !text) return false;

    // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
    const width = text.length * height * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

    // 🏢 FIX (2026-02-20): Rotation-aware hit testing.
    // Transform the test point into the text's LOCAL coordinate system before
    // checking the axis-aligned bounding box. Without this, vertical dimension
    // text (rotated 90°) had a horizontal hit zone — catching clicks from far away.
    let testPoint = point;
    if (rotation !== 0) {
      const rad = degToRad(-rotation); // Inverse rotation to go from world → local
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      testPoint = {
        x: position.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: position.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    // Check if point is within text bounds (local coordinates, axis-aligned)
    const minX = position.x;
    const maxX = position.x + width;
    const minY = position.y - height;
    const maxY = position.y;

    const worldTolerance = tolerance / this.transform.scale;

    return testPoint.x >= minX - worldTolerance &&
           testPoint.x <= maxX + worldTolerance &&
           testPoint.y >= minY - worldTolerance &&
           testPoint.y <= maxY + worldTolerance;
  }
}