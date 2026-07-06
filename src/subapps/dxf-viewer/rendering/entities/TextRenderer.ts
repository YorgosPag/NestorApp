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
import { buildUIFont } from '../../config/text-rendering-config';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
// 🏢 ADR-530: Revit-grade glyph-path text rendering (CAD fonts via opentype.js).
// Reuses the text-engine font SSoT — resolver + glyph-path cache; CSS fillText
// stays as the fallback when no loaded font matches the entity's family.
import { resolveEntityFont, getGlyphRun, GLYPH_REFERENCE_SIZE, type ResolvedFont } from '../../text-engine/fonts';
// ADR-557 — 2D grip render parity: the SAME 10-grip set the interaction +
// 3D paths use (`computeDxfEntityGrips` → `getTextGrips`), so the on-canvas grip
// squares match the rect-box. `gripGlyphShape` paints the move/rotation glyphs.
import { getTextGrips } from '../../bim/text/text-grips';
// ADR-557 Φ-attachment — attachment-aware text-box SSoT: the hitTest hit-box + the 2D
// hover frame use the SAME box as the grips / 3D mesh / culling (one geometry, N consumers).
import { resolveTextBox, textBoxCornersWorld, effectiveTextWidth } from '../../bim/text/text-box';
import { projectToLocalFrame } from '../../bim/grips/grip-math';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';


// ADR-344 Phase 6.E: rich text style shape
type TextRichStyle = {
  bold?: boolean; italic?: boolean; fontFamily?: string;
  runColor?: string; textAlign?: 'left' | 'center' | 'right';
  textBaseline?: 'top' | 'middle' | 'bottom';
  underline?: boolean; overline?: boolean; strikethrough?: boolean;
} | undefined;

// TEMP-DIAG (2026-07-06) — REMOVE WHEN SOLVED. Throttle map for the render box-vs-glyph trace.
const TEXTBOX_DIAG_LAST = new Map<string, number>();

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
    // ADR-557 Φ-attachment — 2D hover frame: stroke the attachment-aware box (the SAME box
    // the grips / 3D mesh use) so the glowing rectangle now appears in 2D too (was: only the
    // glyph turned yellow — no frame), and it coincides exactly with the handles + 3D halo.
    if (options.hovered) this.renderHoverFrame(entity);
    this.finalizeRendering(entity, options);
  }

  /**
   * ADR-557 Φ-attachment — stroke the attachment-aware text box (screen space) as the
   * hover frame. Reuses `textBoxCornersWorld` (rotation-aware) so the rectangle matches
   * the grip box + the 3D `dxfEntityOutlineSegments` halo exactly (one geometry SSoT).
   */
  private renderHoverFrame(entity: EntityModel): void {
    if (!('position' in entity) || !(entity.position as Point2D)) return;
    const dxfText = { ...(entity as unknown as DxfText), height: this.extractTextHeight(entity) };
    const pts = textBoxCornersWorld(dxfText).map((c) => this.worldToScreen(c));
    if (pts.length < 4) return;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
    this.ctx.closePath();
    this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
    this.ctx.lineWidth = 1;
    this.ctx.shadowBlur = HOVER_HIGHLIGHT.TEXT.glowShadowBlur;
    this.ctx.shadowColor = HOVER_HIGHLIGHT.TEXT.glowColor;
    this.ctx.stroke();
    this.ctx.restore();
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
    const baselineMode = richStyle?.textBaseline ?? 'top';
    const hasDecoration = !!(richStyle?.underline || richStyle?.overline || richStyle?.strikethrough);

    this.ctx.save();
    this.ctx.font = buildUIFont(screenHeight, fontFamily, weight, italic);
    // Hover: turn text yellow (matches AutoCAD behaviour — entity turns yellow on hover).
    this.ctx.fillStyle = isHovered
      ? HOVER_HIGHLIGHT.ENTITY.glowColor
      : (richStyle?.runColor || baseColor || UI_COLORS.DEFAULT_ENTITY);
    this.ctx.textAlign = textAlignMode;
    // textBaseline from textNode.attachment[0]: T→top, M→middle, B→bottom. Default 'top' per DXF baseline fix.
    this.ctx.textBaseline = baselineMode;
    // Hover glow: shadowBlur creates visible halo even for sub-pixel text (SHX/unknown fonts).
    // GPU cost acceptable: single entity hover path, not all-entity 60fps render.
    if (isHovered) {
      this.ctx.shadowBlur = HOVER_HIGHLIGHT.TEXT.glowShadowBlur;
      this.ctx.shadowColor = HOVER_HIGHLIGHT.TEXT.glowColor;
    }

    // 🏢 ADR-530: resolve a loaded glyph font for this family; null → CSS fillText
    // fallback (zero regression). Resolved once; the glyph paint reuses the SAME
    // rotation/screenHeight math below — the rotation calculation is unchanged.
    const resolved = resolveEntityFont(fontFamily, { bold: weight === 'bold', italic });

    // 🏢 ADR-557 — AutoCAD TEXT X-scale (`widthFactor`). ONLY a horizontal stretch is
    // added here (the guard's «μόνο πρόσθεση horizontal scale»): around the text
    // origin (screenPos), AFTER the existing rotation, so the rotation/zoom math is
    // untouched. `widthFactor === 1` (every legacy TEXT + every MTEXT, which has none)
    // keeps the original byte-identical paint path — zero regression.
    const widthFactor = ('widthFactor' in entity && typeof entity.widthFactor === 'number' && entity.widthFactor > 0)
      ? entity.widthFactor
      : 1;

    if (normalizedRotation !== 0) {
      this.ctx.translate(screenPos.x, screenPos.y);
      this.ctx.rotate(degToRad(-normalizedRotation));
      if (widthFactor !== 1) this.ctx.scale(widthFactor, 1);
      const w = this.paintText(0, 0, text, screenHeight, textAlignMode, baselineMode, resolved);
      if (hasDecoration) this.paintDecorations(0, 0, w, screenHeight, richStyle, textAlignMode);
    } else if (widthFactor !== 1) {
      this.ctx.translate(screenPos.x, screenPos.y);
      this.ctx.scale(widthFactor, 1);
      const w = this.paintText(0, 0, text, screenHeight, textAlignMode, baselineMode, resolved);
      if (hasDecoration) this.paintDecorations(0, 0, w, screenHeight, richStyle, textAlignMode);
    } else {
      const w = this.paintText(screenPos.x, screenPos.y, text, screenHeight, textAlignMode, baselineMode, resolved);
      if (hasDecoration) this.paintDecorations(screenPos.x, screenPos.y, w, screenHeight, richStyle, textAlignMode);
    }
    // TEMP-DIAG (2026-07-06) — REMOVE WHEN SOLVED. ctx.font is still the text font here.
    this.logTextBoxDiag(entity, text, screenHeight, resolved);
    this.ctx.restore();
  }

  /**
   * TEMP-DIAG (2026-07-06) — REMOVE WHEN SOLVED. Compares the geometry box
   * (`resolveTextBox` → grips/hover/hitTest) with the ACTUAL painted glyph advance
   * (real font metrics). Throttled 1/400 ms per entity id.
   */
  private logTextBoxDiag(
    entity: EntityModel, text: string, screenHeight: number, resolved: ResolvedFont | null,
  ): void {
    if (!('position' in entity) || !(entity.position as Point2D)) return;
    const id = String((entity as { id?: string | number }).id ?? '');
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - (TEXTBOX_DIAG_LAST.get(id) ?? 0) < 400) return;
    TEXTBOX_DIAG_LAST.set(id, now);

    const scale = this.transform.scale;
    const realPx = resolved
      ? getGlyphRun(resolved.font, resolved.cacheName, text).metrics.width * (screenHeight / GLYPH_REFERENCE_SIZE)
      : this.ctx.measureText(text).width;
    const realWorldW = realPx / scale;
    const dxfText = { ...(entity as unknown as DxfText), height: this.extractTextHeight(entity) };
    const boxWorldW = effectiveTextWidth(dxfText);
    const box = resolveTextBox(dxfText);
    const pos = entity.position as Point2D;
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    // eslint-disable-next-line no-console
    console.log('[TEXTBOX-DIAG]', {
      id, text,
      font: resolved ? resolved.cacheName : 'css-fallback',
      posX: r2(pos.x), posY: r2(pos.y),
      boxWorldW: r2(boxWorldW), realWorldW: r2(realWorldW), deltaW: r2(boxWorldW - realWorldW),
      boxCenterX: r2(box.center.x), glyphCenterX: r2(pos.x + realWorldW / 2),
      boxCenterMinusGlyphCenterX: r2(box.center.x - (pos.x + realWorldW / 2)),
      widthFactor: (entity as { widthFactor?: number }).widthFactor ?? 1,
      hasWidth: (entity as { width?: number }).width ?? null,
    });
  }

  /**
   * 🏢 ADR-530: paint a single run at (originX, originY) — glyph path when a
   * loaded CAD font resolved, else the legacy CSS fillText. Returns the rendered
   * advance width in px (used to position text decorations).
   */
  private paintText(
    originX: number, originY: number, text: string, screenHeight: number,
    align: CanvasTextAlign, baseline: CanvasTextBaseline, resolved: ResolvedFont | null,
  ): number {
    if (resolved) {
      return this.fillGlyphRun(originX, originY, text, screenHeight, align, baseline, resolved);
    }
    this.ctx.fillText(text, originX, originY);
    return this.ctx.measureText(text).width;
  }

  /**
   * 🏢 ADR-530: fill a cached glyph Path2D. Paths are built once at a reference
   * em size (zoom-stable cache); the per-frame scale = screenHeight / refSize is
   * applied via ctx.scale, so paths are never rebuilt on zoom.
   */
  private fillGlyphRun(
    originX: number, originY: number, text: string, screenHeight: number,
    align: CanvasTextAlign, baseline: CanvasTextBaseline, resolved: ResolvedFont,
  ): number {
    const run = getGlyphRun(resolved.font, resolved.cacheName, text);
    const s = screenHeight / GLYPH_REFERENCE_SIZE;
    const widthPx = run.metrics.width * s;
    const ascentPx = run.metrics.ascent * s;
    const descentPx = run.metrics.descent * s;
    const xOff = align === 'center' ? -widthPx / 2 : align === 'right' ? -widthPx : 0;
    // Glyph paths are baseline-anchored; map to the canvas textBaseline modes.
    const baselineY = baseline === 'middle' ? (ascentPx - descentPx) / 2
      : baseline === 'bottom' ? -descentPx
        : ascentPx; // 'top' / 'alphabetic' default → drop by ascent so the top sits at originY
    this.ctx.save();
    this.ctx.translate(originX + xOff, originY + baselineY);
    this.ctx.scale(s, s);
    this.ctx.fill(run.path);
    this.ctx.restore();
    return widthPx;
  }

  /**
   * Paint underline / overline / strikethrough rules. Offsets are fractions of
   * screenHeight relative to the text origin, accounting for the textBaseline
   * (baselineVOffset: 0=top, 0.5=middle, 1.0=bottom).
   */
  private paintDecorations(
    x: number, y: number, width: number, screenHeight: number,
    richStyle: TextRichStyle, align: CanvasTextAlign,
  ): void {
    const baselineVOffset = richStyle?.textBaseline === 'middle' ? 0.5 : richStyle?.textBaseline === 'bottom' ? 1.0 : 0;
    const thickness = Math.max(1, screenHeight * 0.07);
    const xOff = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
    if (richStyle?.underline)     this.ctx.fillRect(x + xOff, y + screenHeight * ( 0.90 - baselineVOffset), width, thickness);
    if (richStyle?.overline)      this.ctx.fillRect(x + xOff, y + screenHeight * (-0.05 - baselineVOffset), width, thickness);
    if (richStyle?.strikethrough) this.ctx.fillRect(x + xOff, y + screenHeight * ( 0.40 - baselineVOffset), width, thickness);
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
    if (!('position' in entity) || !(entity.position as Point2D)) return [];

    // ADR-557 — FULL rect-box parity with the interaction + 3D paths: render the
    // SAME 10 grips `computeDxfEntityGrips` emits (4 corners + 4 edge midpoints +
    // centre MOVE + rotation), mapped to the render `GripInfo` shape (mirror
    // `ColumnRenderer.getGrips`). `extractTextHeight` guarantees a positive height
    // for the box even when the flat `height` is absent.
    const dxfText = { ...(entity as unknown as DxfText), height: this.extractTextHeight(entity) };
    return getTextGrips(dxfText).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      // ADR-557 — centre → 4-arrow MOVE glyph, rotation → curved-arrow glyph (shared
      // registry SSoT, mirror Column/Wall); corners + edges stay square.
      shape: gripGlyphShape(g.textGripKind),
    }));
  }

  /**
   * Hit testing for text entities (simplified like old backup)
   * 🏢 ADR-105: Use centralized fallback tolerance
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return false;
    if (!('position' in entity) || !(entity.position as Point2D)) return false;

    // ADR-557 Φ-attachment — test against the attachment-aware text box SSoT (the SAME box
    // the grips / hover frame / 3D mesh / culling use). The box is rotation-aware and honours
    // the TEXT X-scale (widthFactor) + MTEXT width, so the hit zone === the drawn glyphs.
    const dxfText = { ...(entity as unknown as DxfText), height: this.extractTextHeight(entity) };
    const box = resolveTextBox(dxfText);
    // World → box-local: the click is inside iff |localX| ≤ halfWidth and |localY| ≤ halfLength.
    const local = projectToLocalFrame({ x: point.x - box.center.x, y: point.y - box.center.y }, box.rotationDeg);
    const worldTolerance = tolerance / this.transform.scale;
    return Math.abs(local.x) <= box.halfWidth + worldTolerance &&
           Math.abs(local.y) <= box.halfLength + worldTolerance;
  }
}