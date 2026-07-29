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
// ADR-557 Φάση C — the single-line glyph-run paint SSoT (`paintTextRun`), shared with the 3D
// textured-plane converter so 2D & 3D draw the SAME outlines. `getGlyphRun`/`GLYPH_REFERENCE_SIZE`
// now live inside that SSoT (was the old private `fillGlyphRun`).
import { resolveEntityFont, paintTextRun, emSizeForTextHeight, type ResolvedFont } from '../../text-engine/fonts';
// ADR-557 — 2D grip render parity: the SAME 10-grip set the interaction +
// 3D paths use (`computeDxfEntityGrips` → `getTextGrips`), so the on-canvas grip
// squares match the rect-box. `gripGlyphShape` paints the move/rotation glyphs.
import { getTextGrips } from '../../bim/text/text-grips';
// ADR-557 Φ-attachment — attachment-aware text-box SSoT: the hitTest hit-box + the 2D
// hover frame use the SAME box as the grips / 3D mesh / culling (one geometry, N consumers).
import { resolveTextBox, textBoxCornersWorld, advanceStyleOf } from '../../bim/text/text-box';
// ADR-635 Φ C.20 — ΤΟ ΙΔΙΟ SSoT διάταξης που διαβάζει το κουτί/λαβές: αναδίπλωση στη στήλη
// (group 41), στηλοθέτες, και στυλ ανά run. Μία απόφαση αναδίπλωσης, δύο καταναλωτές.
// ADR-635 Φ C.21 — το span κουβαλά ΤΟ στυλ της μέτρησής του + τις διακοσμήσεις του run.
import {
  layoutTextBlock, hasAnyDecoration, totalExtraLineRatio,
  type TextLayoutLine, type TextLayoutSpan, type TextSpanDecoration,
} from '../../bim/text/text-layout';
// ADR-557 (multi-line) — split flat `text` on `\n` and stack each line at its own y-offset,
// with the SAME line-spacing + attachment distribution the box SSoT uses (render ≡ box).
import { resolveMultilineExtentsFromExtra, type TextRow } from '../../bim/text/text-lines';
// ADR-557 — the oblique shear SSoT. The box (`text-box.ts`) reads the SAME map (world y-up);
// this screen-y-DOWN path negates it ONCE (below) — the only place the y-flip lives.
import { obliqueShearFromAngle } from '../../bim/text/text-oblique';
import { projectToLocalFrame } from '../../bim/grips/grip-math';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';


// ADR-344 Phase 6.E: rich text style shape
type TextRichStyle = {
  bold?: boolean; italic?: boolean; fontFamily?: string;
  runColor?: string; textAlign?: 'left' | 'center' | 'right';
  textBaseline?: 'top' | 'middle' | 'bottom';
  underline?: boolean; overline?: boolean; strikethrough?: boolean;
  obliqueAngle?: number; // ADR-557 — AutoCAD oblique (shear) angle in degrees
  tracking?: number; // AutoCAD `\T` — inter-glyph spacing factor (1 = normal)
} | undefined;

/**
 * ADR-635 Φ C.20 — everything the per-span paint needs, bundled so the two paint helpers keep
 * ≤ 40-line bodies (N.7.1) instead of a 14-parameter signature.
 */
interface LayoutPaintOptions {
  readonly firstOffsetPx: number;
  readonly screenHeight: number;
  /** World → screen px factor (`transform.scale`) — span offsets arrive in world units. */
  readonly worldToPx: number;
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
  /**
   * Per-render memo for `resolveEntityFont` — a real MTEXT has ~140 spans over a handful of
   * distinct (family, bold, italic) triples, so resolving per span would repeat the same
   * cache+substitution walk dozens of times per repaint on a GPU-less machine.
   */
  readonly fontMemo: Map<string, ResolvedFont | null>;
  /** Colour for spans that inherit (ByLayer/ByBlock): entity colour → layer → default. */
  readonly fallbackFill: string;
  /** Overrides EVERY span colour (hover) — undefined in the normal paint. */
  readonly forcedFill?: string;
}

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

    this.ctx.save();
    this.ctx.font = buildUIFont(screenHeight, fontFamily, weight, italic);
    // Hover: turn text yellow (matches AutoCAD behaviour — entity turns yellow on hover).
    this.ctx.fillStyle = isHovered
      ? HOVER_HIGHLIGHT.ENTITY.glowColor
      : (richStyle?.runColor || baseColor || UI_COLORS.DEFAULT_ENTITY);
    // 🐛 ADR-635 Φ C.21 — τα spans είναι ΑΡΙΣΤΕΡΑ-ΑΓΚΥΡΩΜΕΝΑ: η στοίχιση της γραμμής μπαίνει
    // ΜΙΑ φορά στο x της γραμμής (`paintLayoutLines`). Το `ctx.textAlign` όμως διαβάζεται από
    // το `fillText` της CSS-εφεδρικής διαδρομής **παρακάμπτοντας** την παράμετρο `align` που
    // περνάμε — οπότε σε κάθε MTEXT με αγκύρωση TC/TR κάθε span στοιχιζόταν ΞΕΧΩΡΙΣΤΑ πάνω στο
    // δικό του x και τα spans έπεφταν το ένα πάνω στο άλλο. Ο καμβάς μένει σε 'left'.
    this.ctx.textAlign = 'left';
    // textBaseline from textNode.attachment[0]: T→top, M→middle, B→bottom. Default 'top' per DXF baseline fix.
    this.ctx.textBaseline = baselineMode;
    // Hover glow: shadowBlur creates visible halo even for sub-pixel text (SHX/unknown fonts).
    // GPU cost acceptable: single entity hover path, not all-entity 60fps render.
    if (isHovered) {
      this.ctx.shadowBlur = HOVER_HIGHLIGHT.TEXT.glowShadowBlur;
      this.ctx.shadowColor = HOVER_HIGHLIGHT.TEXT.glowColor;
    }

    // 🏢 ADR-557 — AutoCAD TEXT X-scale (`widthFactor`). ONLY a horizontal stretch is
    // added here (the guard's «μόνο πρόσθεση horizontal scale»): around the text
    // origin (screenPos), AFTER the existing rotation, so the rotation/zoom math is
    // untouched. `widthFactor === 1` (every legacy TEXT + every MTEXT, which has none)
    // keeps the original byte-identical paint path — zero regression.
    const widthFactor = ('widthFactor' in entity && typeof entity.widthFactor === 'number' && entity.widthFactor > 0)
      ? entity.widthFactor
      : 1;

    // 🏢 ADR-557 — AutoCAD TEXT oblique angle (`run.style.obliqueAngle`, degrees). Rendered
    // as a horizontal shear around the text anchor, AFTER rotation + widthFactor (same block,
    // so the rotation/zoom math is untouched). Screen-y is DOWN → `-tan(θ)` makes a positive
    // angle lean FORWARD (top-right, like italic «/») for EVERY attachment anchor. `0` (every
    // upright TEXT + legacy path) keeps the original byte-identical paint path — zero regression.
    // ADR-557 — read the oblique shear from the SSoT (world y-up `+tan θ`) and NEGATE for the
    // screen y-DOWN frame. The box (`text-box.ts`) reads the same SSoT unnegated → box ≡ glyphs.
    const obliqueAngle = (richStyle && typeof richStyle.obliqueAngle === 'number') ? richStyle.obliqueAngle : 0;
    const obliqueShear = -obliqueShearFromAngle(obliqueAngle);

    // ADR-557 (multi-line) — split on `\n`; each line steps down by `advancePx`. The block is
    // shifted so `position` stays the attachment anchor (T/M/B) — `firstOffsetPx = −topAdd·height`,
    // the exact rule the box SSoT applies, so the drawn lines fill the grip/hover box precisely.
    // 🏢 ADR-635 Φ C.20 — οι ΟΠΤΙΚΕΣ γραμμές έρχονται από το κοινό `layoutTextBlock`:
    // αναδίπλωση μέσα στη στήλη του MTEXT (group 41), στηλοθέτες `\t` σε πραγματικές θέσεις,
    // και στυλ **ανά run** (χρώμα/γραμματοσειρά/ύψος). Το `text-box.ts` καλεί το ΙΔΙΟ, οπότε
    // κουτί/λαβές/hover/hit-test βλέπουν ακριβώς τις γραμμές που ζωγραφίζονται.
    const dxfText = entity as unknown as DxfText;
    const worldToPx = this.transform.scale;
    const worldHeight = worldToPx > 0 ? screenHeight / worldToPx : screenHeight;
    const layout = layoutTextBlock(dxfText, worldHeight, advanceStyleOf(dxfText));
    const row: TextRow = baselineMode === 'middle' ? 'M' : baselineMode === 'bottom' ? 'B' : 'T';
    // ADR-635 Φ C.21 (Δ) — το βήμα γραμμής ΔΕΝ είναι σταθερό: το `\ps` το ορίζει ανά παράγραφο.
    // Renderer και κουτί διαβάζουν το ΙΔΙΟ άθροισμα (`totalExtraLineRatio`), αλλιώς η πρώτη
    // γραμμή τοποθετούνταν με άλλη υπόθεση από αυτήν που έδινε το ύψος του κουτιού.
    const firstOffsetPx =
      -resolveMultilineExtentsFromExtra(row, totalExtraLineRatio(layout)).topAdd * screenHeight;
    // Το hover νικά κάθε χρώμα run (AutoCAD: όλη η οντότητα κιτρινίζει)· αλλιώς το χρώμα του
    // span, και τελευταίο δίχτυ το χρώμα οντότητας/layer.
    const fallbackFill = isHovered
      ? HOVER_HIGHLIGHT.ENTITY.glowColor
      : (richStyle?.runColor || baseColor || UI_COLORS.DEFAULT_ENTITY);
    const paint = (ox: number, oy: number) =>
      this.paintLayoutLines(ox, oy, layout, {
        firstOffsetPx, screenHeight, worldToPx, align: textAlignMode,
        baseline: baselineMode, fontMemo: new Map(),
        fallbackFill, forcedFill: isHovered ? HOVER_HIGHLIGHT.ENTITY.glowColor : undefined,
      });

    // ADR-557 — any of rotation / widthFactor / oblique needs a local frame around the
    // anchor; when all are neutral, keep the original anchor-space paint (byte-identical).
    if (normalizedRotation !== 0 || widthFactor !== 1 || obliqueShear !== 0) {
      this.ctx.translate(screenPos.x, screenPos.y);
      if (normalizedRotation !== 0) this.ctx.rotate(degToRad(-normalizedRotation));
      // ADR-557 — shear BEFORE the widthFactor scale so the lean is `tan θ` per unit height
      // INDEPENDENT of widthFactor (else `scale(wf,1)` would multiply the shear by `wf` and the
      // box — which shears the world advance directly — would no longer match for wf ≠ 1).
      if (obliqueShear !== 0) this.ctx.transform(1, 0, obliqueShear, 1, 0, 0);
      if (widthFactor !== 1) this.ctx.scale(widthFactor, 1);
      paint(0, 0);
    } else {
      paint(screenPos.x, screenPos.y);
    }
    this.ctx.restore();
  }

  /**
   * ADR-557 (multi-line) + ADR-635 Φ C.20 (rich) — paint each VISUAL line at
   * `origin + firstOffset + i·advance` (screen y-down), span by span.
   *
   * Κάθε span κρατά το δικό του x (από τη διάταξη: στηλοθέτες + αναδίπλωση) και το δικό του
   * στυλ, οπότε ένα MTEXT με δεκάδες αλλαγές `\C`/`\f`/`\H` βάφεται όπως στο AutoCAD αντί να
   * ισοπεδώνεται στο στυλ του πρώτου run. Τα spans είναι αριστερά-αγκυρωμένα και η στοίχιση
   * της γραμμής εφαρμόζεται ΜΙΑ φορά στο x της γραμμής (το `ctx.textAlign` ανά span θα
   * στοίχιζε το καθένα χωριστά και θα τα έριχνε το ένα πάνω στο άλλο).
   */
  private paintLayoutLines(
    originX: number, originY: number, layout: readonly TextLayoutLine[], opts: LayoutPaintOptions,
  ): void {
    const { firstOffsetPx, screenHeight, worldToPx, align } = opts;
    // Συσσωρευτική θέση: κάθε γραμμή πέφτει κατά ΤΟ ΔΙΚΟ ΤΗΣ βήμα (`\ps` ανά παράγραφο).
    let y = originY + firstOffsetPx;
    for (let i = 0; i < layout.length; i++) {
      const line = layout[i];
      if (i > 0) y += line.spacingRatio * screenHeight;
      const lineWidthPx = line.widthWorld * worldToPx;
      // Δύο ΑΝΕΞΑΡΤΗΤΕΣ στοιχίσεις, με αυτή τη σειρά (AutoCAD): πρώτα η στοίχιση **παραγράφου**
      // μέσα στη στήλη (`\pxqc`/`\pxqr` → `xOffsetWorld`, ADR-635 Φ C.21), μετά η **αγκύρωση**
      // της οντότητας (κωδ. 71 → `align`) που τοποθετεί ολόκληρο το μπλοκ.
      const xOff = (align === 'center' ? -lineWidthPx / 2 : align === 'right' ? -lineWidthPx : 0)
        + line.xOffsetWorld * worldToPx;
      for (const span of line.spans) {
        this.paintLayoutSpan(originX + xOff + span.xWorld * worldToPx, y, span, opts);
      }
    }
  }

  /**
   * Paint ONE span with ITS OWN resolved style (left-anchored at `x`).
   *
   * 🐛 ADR-635 Φ C.21 — εδώ έγραφε `span.bold ?? opts.richStyle?.bold`, δηλαδή κληρονομούσε το
   * στυλ του **μπλοκ** (= του ΠΡΩΤΟΥ run) όποτε το span δεν δήλωνε ρητά κάτι. Επειδή το span
   * κρατούσε σημαία μόνο όταν ήταν αληθής, ένα ρητό `b0` ήταν αδιάκριτο από «δεν δηλώθηκε» ⇒
   * ολόκληρο το MTEXT του δείγματος βαφόταν έντονο ενώ η **διάταξη το είχε μετρήσει κανονικό**:
   * κάθε span ζωγραφιζόταν πλατύτερο απ' όσο μετρήθηκε, καβαλούσε το επόμενο («ΦΕΚ405») και η
   * γραμμή ξεχείλιζε δεξιά. Τώρα το span κουβαλά ΤΟ στυλ της μέτρησής του και δεν υπάρχει
   * τίποτα να «κληρονομηθεί» — μέτρηση και βαφή δεν μπορούν δομικά να αποκλίνουν.
   */
  private paintLayoutSpan(
    x: number, y: number, span: TextLayoutSpan, opts: LayoutPaintOptions,
  ): void {
    const spanHeightPx = Math.max(1, span.heightWorld * opts.worldToPx);
    const style = span.style;
    const family = style.fontFamily || 'arial';
    const weight: 'normal' | 'bold' = style.bold ? 'bold' : 'normal';
    const italic = style.italic;
    this.ctx.font = buildUIFont(spanHeightPx, family, weight, italic);
    this.ctx.fillStyle = opts.forcedFill ?? span.color ?? opts.fallbackFill;
    const tracking = style.tracking != null && style.tracking > 0 ? style.tracking : 1;
    const advance = this.paintText(
      x, y, span.text, spanHeightPx, 'left', opts.baseline,
      this.resolveSpanFont(family, weight === 'bold', italic, opts), tracking,
    );
    if (hasAnyDecoration(span.decoration)) {
      this.paintDecorations(x, y, advance, spanHeightPx, span.decoration, opts.baseline);
    }
  }

  /** `resolveEntityFont` behind the per-render memo (≈140 spans, a handful of distinct faces). */
  private resolveSpanFont(
    family: string, bold: boolean, italic: boolean | undefined, opts: LayoutPaintOptions,
  ): ResolvedFont | null {
    const key = `${family}|${bold ? 1 : 0}|${italic ? 1 : 0}`;
    const hit = opts.fontMemo.get(key);
    if (hit !== undefined) return hit;
    const resolved = resolveEntityFont(family, { bold, italic });
    opts.fontMemo.set(key, resolved);
    return resolved;
  }

  /**
   * 🏢 ADR-530 / ADR-557 Φάση C: paint a single run at (originX, originY) via the shared
   * glyph-run SSoT (`paintTextRun`) — the cached glyph Path2D when a loaded CAD font resolved
   * (zoom-stable, tracking baked in), else the legacy CSS fillText on the `ctx.font` set by
   * `setupStyle`. Returns the advance width in px (decoration positioning). The 3D
   * textured-plane converter (`dxf-text-3d.ts`) calls the SAME SSoT — one font engine, 2D ≡ 3D.
   */
  private paintText(
    originX: number, originY: number, text: string, screenHeight: number,
    align: CanvasTextAlign, baseline: CanvasTextBaseline, resolved: ResolvedFont | null,
    tracking = 1,
  ): number {
    // ADR-635 Φ C.22 — `screenHeight` is a DXF TEXT HEIGHT (group 40 / `\H`, scaled to px), and the
    // font em that renders it as AutoCAD does is LARGER by the face's cap-height ratio. The SAME
    // conversion runs inside `measureTextAdvanceWorld`, so the layout that placed this span
    // measured it at exactly this size — measure ≡ paint (Φ C.21's «ΦΕΚ405» invariant).
    return paintTextRun(this.ctx, text, {
      originX, originY, emSize: emSizeForTextHeight(screenHeight, resolved),
      align, baseline, resolved, tracking,
    });
  }

  /**
   * Paint underline / overline / strikethrough rules for ONE span. Offsets are fractions of
   * the SPAN height relative to the text origin, accounting for the textBaseline
   * (baselineVOffset: 0=top, 0.5=middle, 1.0=bottom). The rule inherits `ctx.fillStyle`, i.e.
   * the span's own colour — AutoCAD underlines in the colour of the underlined run.
   *
   * ADR-635 Φ C.21 — ήταν ΑΝΑ ΓΡΑΜΜΗ με τις σημαίες του μπλοκ, οπότε ένα `\L` στον πρώτο run
   * υπογράμμιζε ολόκληρο το MTEXT· το AutoCAD υπογραμμίζει μόνο τον τίτλο. Spans είναι πάντα
   * αριστερά-αγκυρωμένα, άρα δεν υπάρχει πια όρισμα `align`.
   */
  private paintDecorations(
    x: number, y: number, width: number, spanHeight: number,
    decoration: TextSpanDecoration, baseline: CanvasTextBaseline,
  ): void {
    const baselineVOffset = baseline === 'middle' ? 0.5 : baseline === 'bottom' ? 1.0 : 0;
    const thickness = Math.max(1, spanHeight * 0.07);
    if (decoration.underline)     this.ctx.fillRect(x, y + spanHeight * ( 0.90 - baselineVOffset), width, thickness);
    if (decoration.overline)      this.ctx.fillRect(x, y + spanHeight * (-0.05 - baselineVOffset), width, thickness);
    if (decoration.strikethrough) this.ctx.fillRect(x, y + spanHeight * ( 0.40 - baselineVOffset), width, thickness);
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
      shape: gripGlyphShape(gripKindOf(g, 'text')),
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