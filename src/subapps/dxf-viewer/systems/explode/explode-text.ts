/**
 * ADR-733 — TEXT/MTEXT EXPLODE σε γεωμετρία (SSoT, pure): μετατρέπει ένα κείμενο στα
 * ΠΡΑΓΜΑΤΙΚΑ περιγράμματα των glyphs του (opentype outlines → κλειστά LWPOLYLINE contours),
 * σε world units — vector-first, ΟΧΙ το WMFOUT/WMFIN screen hack του AutoCAD TXTEXP.
 *
 * Σημασιολογία δύο σταδίων (ADR-733 §2.1):
 *   - Κάθε ΓΡΑΜΜΑ γίνεται ΜΙΑ επιλέξιμη μονάδα: glyph με ≥2 contours (π.χ. «Ο», «Β») →
 *     GroupEntity με μέλη τα contour polylines του· glyph με 1 contour → σκέτο polyline.
 *   - EXPLODE στο group ενός γράμματος = UNGROUP (ADR-575) → ωμά contours. Ήδη δουλεύει.
 *
 * Parity contract (ADR-635 Φ C.20/C.21): περπατάμε ΤΟ ΙΔΙΟ `layoutTextBlock` που ζωγραφίζει
 * ο renderer, με τα ΙΔΙΑ SSoT βήματα (πρώτη γραμμή/διάστιχο, στοίχιση, `emSizeForTextHeight`,
 * baseline ανά attachment row όπως το `drawGlyphRunToCanvas`) — ό,τι βλέπει η οθόνη, αυτό
 * γίνεται γεωμετρία. Ο renderer δουλεύει σε screen y-down· εδώ τα ΙΔΙΑ τοπικά μαθηματικά
 * τρέχουν σε world units (worldToPx = 1) και το τελικό affine είναι το συζυγές του δικού του:
 *
 *     world = position + R(θ) · Shear(+tanφ) · Scale(wf, 1) · diag(1, −1) · p_local
 *
 * (Η αντιστροφή προσήμων R/Shear προκύπτει από τη συζυγία με το y-flip — ίδια αρχή με το
 * «−rotation λόγω Y-flip» του TextRenderer.)
 *
 * Όρια Φ1 (ADR-733 §2.4): span που δεν λύνει σε φορτωμένη opentype γραμματοσειρά
 * (`resolveEntityFont` → null: italic, μη-bundled faces) ⇒ ΟΛΟ το entity επιστρέφει `null`
 * (no-op) — τίμιο «δεν γίνεται» αντί για λάθος γεωμετρία από το CSS fillText tier.
 *
 * FULL SSoT reuse — zero re-implemented geometry:
 *   - `layoutTextBlock`/`totalExtraLineRatio` → bim/text/text-layout
 *   - `advanceStyleOf`                        → bim/text/text-box
 *   - `resolveMultilineExtentsFromExtra`      → bim/text/text-lines
 *   - `obliqueShearFromAngle`                 → bim/text/text-oblique
 *   - `resolveEntityFont`/`emSizeForTextHeight`/`measureText` → text-engine/fonts
 *   - `flattenOtCommands`                     → utils/geometry/ot-path-flatten (ADR-608 πυρήνες)
 *   - `inheritEntityStyle` / `generateEntityId` / `createGroupEntity` → υπάρχοντα SSoTs
 *
 * @see systems/explode/explode-entity.ts (ο δρομολογητής EXPLODE — delegation εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-733-text-explode-to-geometry.md
 */

import type { Font, Path as OtPath } from 'opentype.js';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, TextEntity, MTextEntity, LWPolylineEntity } from '../../types/entities';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import {
  layoutTextBlock, totalExtraLineRatio, hasAnyDecoration, type TextLayoutSpan,
} from '../../bim/text/text-layout';
import { advanceStyleOf } from '../../bim/text/text-box';
// ADR-635 Φ C.26 — anchor SSoTs: ΙΔΙΟΙ χάρτες με renderer/box (και για το 'alphabetic' —
// DXF baseline anchor, group 73 = 0 — που το 3×3 attachment grid δεν εκφράζει).
import { resolveMultilineExtentsFromExtra, verticalAnchorToRow } from '../../bim/text/text-lines';
import { obliqueShearFromAngle } from '../../bim/text/text-oblique';
import {
  resolveEntityFont, emSizeForTextHeight, measureText, type ResolvedFont,
} from '../../text-engine/fonts';
import {
  anchorBandFraction, baselineOffsetFromAnchor, measureTextGlyphInk,
} from '../../text-engine/fonts/text-vertical-metrics';
import { TEXT_DECORATION_RATIOS } from '../../config/text-rendering-config';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { flattenOtCommands } from '../../utils/geometry/ot-path-flatten';
import { inheritEntityStyle } from '../entity-creation/inherit-entity-style';
import { generateEntityId } from '../entity-creation/utils';
import { createGroupEntity } from '../group/group-entity';
// Η οντότητα ΣΚΗΝΗΣ συνήθως ΔΕΝ κουβαλά το flat `textStyle` — ο renderer το παράγει από το
// textNode (πρώτο run + attachment) μέσω αυτού του SSoT. Χωρίς το ίδιο βήμα εδώ, ένα MTEXT
// με αγκύρωση MC/BR ή oblique θα γινόταν explode σαν TL/όρθιο (parity gap).
import { extractFirstRunStyle } from '../../hooks/canvas/dxf-text-style-extractor';

/**
 * Χορδική ανοχή flatten = ύψος span ÷ αυτό (ADR-733 §2.3): κλιμακώνεται με το μέγεθος του
 * κειμένου, ώστε οι καμπύλες να μένουν ομαλές σε κάθε λογικό zoom χωρίς εκρηκτικό αριθμό κορυφών.
 */
const CHORD_TOLERANCE_DIVISOR = 200;

/** Fallback ύψους — AutoCAD Standard DIMTXT default (mirror `TextRenderer.extractTextHeight`). */
const DEFAULT_TEXT_HEIGHT = 2.5;

/** Το affine local(y-down) → world(y-up) του κειμένου, προ-υπολογισμένο μία φορά. */
interface TextWorldFrame {
  readonly position: Point2D;
  readonly cos: number;
  readonly sin: number;
  readonly widthFactor: number;
  /** Shear του oblique angle σε world y-up (+tan φ) — το ΙΔΙΟ SSoT που διαβάζει το text-box. */
  readonly shear: number;
}

/** world = position + R(θ)·Shear·Scale(wf)·diag(1,−1)·p — βλ. σχόλιο κεφαλίδας. */
function toWorld(f: TextWorldFrame, p: Point2D): Point2D {
  const yUp = -p.y;
  const x = p.x * f.widthFactor + f.shear * yUp;
  return {
    x: f.position.x + x * f.cos - yUp * f.sin,
    y: f.position.y + x * f.sin + yUp * f.cos,
  };
}

/** Ύψος κειμένου με τις προτεραιότητες του renderer: height → fontSize → DIMTXT default. */
function textHeightOf(entity: TextEntity | MTextEntity): number {
  if (typeof entity.height === 'number' && entity.height > 0) return entity.height;
  if (typeof entity.fontSize === 'number' && entity.fontSize > 0) return entity.fontSize;
  return DEFAULT_TEXT_HEIGHT;
}

/**
 * Ίδιο cast με τον renderer (`entity as DxfText`), με εγγυημένα θετικό `height` και με το
 * flat `textStyle` ΠΑΡΑΓΟΜΕΝΟ από το textNode όταν λείπει (`extractFirstRunStyle` — το ίδιο
 * βήμα που κάνει ο scene→DxfText converter πριν φτάσει η οντότητα στον renderer).
 */
function toDxfText(entity: TextEntity | MTextEntity): DxfText {
  const flat = entity as unknown as DxfText;
  const textStyle = flat.textStyle ?? extractFirstRunStyle(entity);
  return { ...flat, height: textHeightOf(entity), ...(textStyle ? { textStyle } : {}) };
}

function worldFrameOf(text: DxfText): TextWorldFrame {
  const rad = degToRad(text.rotation ?? 0);
  const wf = typeof text.widthFactor === 'number' && text.widthFactor > 0 ? text.widthFactor : 1;
  return {
    position: text.position,
    cos: Math.cos(rad),
    sin: Math.sin(rad),
    widthFactor: wf,
    shear: obliqueShearFromAngle(text.textStyle?.obliqueAngle),
  };
}

/** Memo key ενός span style — ίδια τριάδα με το `TextRenderer.resolveSpanFont`. */
function fontKeyOf(span: TextLayoutSpan): string {
  const s = span.style;
  return `${s.fontFamily || 'arial'}|${s.bold ? 1 : 0}|${s.italic ? 1 : 0}`;
}

/**
 * Επιλύει ΟΛΕΣ τις γραμματοσειρές του layout πριν παραχθεί οτιδήποτε. Ένα ΜΗ-κενό span
 * χωρίς φορτωμένη opentype γραμματοσειρά ⇒ `null` (το entity δεν explode-άρεται — Φ1 όριο).
 * Κενά spans (μόνο κενά/tabs) δεν απαιτούν γραμματοσειρά — δεν έχουν μελάνι.
 */
function resolveLayoutFonts(
  lines: ReturnType<typeof layoutTextBlock>,
): Map<string, ResolvedFont | null> | null {
  const fonts = new Map<string, ResolvedFont | null>();
  for (const line of lines) {
    for (const span of line.spans) {
      const key = fontKeyOf(span);
      if (!fonts.has(key)) {
        fonts.set(key, resolveEntityFont(span.style.fontFamily, {
          bold: !!span.style.bold, italic: span.style.italic,
        }));
      }
      if (span.text.trim() !== '' && fonts.get(key) === null) return null;
    }
  }
  return fonts;
}

/** Σταθερό συμβόλαιο παραγώγων: κληρονομημένο στυλ + φρέσκο id + νέα γεωμετρία. */
interface DerivedContext {
  readonly frame: TextWorldFrame;
  readonly styleBase: Record<string, unknown>;
  readonly layerId: string | undefined;
}

/** Κλειστό/ανοιχτό contour → LWPOLYLINE σε world coords· `null` σε μη-πεπερασμένη γεωμετρία. */
function makeContourPolyline(
  ctx: DerivedContext, points: readonly Point2D[], closed: boolean,
): LWPolylineEntity | null {
  const vertices = points.map((p) => toWorld(ctx.frame, p));
  for (const v of vertices) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  }
  return {
    ...ctx.styleBase,
    id: generateEntityId(),
    type: 'lwpolyline',
    layerId: ctx.layerId,
    vertices,
    closed,
    selected: false,
  } as LWPolylineEntity;
}

/**
 * ΕΝΑ glyph → οι μονάδες του σταδίου 1: ≥2 contours → GroupEntity (το γράμμα ως ενιαία
 * επιλέξιμη μονάδα)· 1 contour → σκέτο polyline· κανένα μελάνι (κενό) → τίποτα.
 */
function glyphToEntities(ctx: DerivedContext, path: OtPath, tolerance: number): Entity[] {
  const contours = flattenOtCommands(path.commands, tolerance)
    .map((sub) => makeContourPolyline(ctx, sub.points, sub.closed))
    .filter((e): e is LWPolylineEntity => e !== null);
  if (contours.length >= 2) return [createGroupEntity(contours) as Entity];
  return contours;
}

/**
 * Per-glyph paths ενός span. `tracking === 1` → `font.getPaths` (kerned, byte-parity με το
 * `stringToPath2D` fast path)· tracking ≠ 1 → per-glyph pen advance × tracking (ίδιος κανόνας
 * με το tracked branch του `stringToPath2D` — τα σχήματα ανέγγιχτα, μόνο τα κενά αλλάζουν).
 */
function glyphPathsOf(
  font: Font, text: string, x: number, baselineY: number, em: number, tracking: number,
): OtPath[] {
  if (tracking === 1) return font.getPaths(text, x, baselineY, em);
  const paths: OtPath[] = [];
  let penX = x;
  for (const ch of text) {
    paths.push(font.getPath(ch, penX, baselineY, em));
    penX += font.getAdvanceWidth(ch, em) * tracking;
  }
  return paths;
}

/** Ορθογώνιο διακόσμησης (underline/overline/strikethrough) ως κλειστό polyline. */
function makeDecorationRect(
  ctx: DerivedContext, x: number, top: number, width: number, thickness: number,
): LWPolylineEntity | null {
  return makeContourPolyline(ctx, [
    { x, y: top },
    { x: x + width, y: top },
    { x: x + width, y: top + thickness },
    { x, y: top + thickness },
  ], true);
}

/**
 * Διακοσμήσεις run → γεωμετρία, με ΤΑ ΙΔΙΑ κλάσματα em που ζωγραφίζει ο renderer
 * (`TEXT_DECORATION_RATIOS` — μία πηγή, δύο καταναλωτές). Θέσεις από το text origin του
 * span, όπως το `paintDecorations`· το `baselineVOffset` έρχεται από το `anchorBandFraction`
 * SSoT (ADR-635 Φ C.26) — ΟΧΙ από τοπικό 0/0.5/1 ternary (που δεν ήξερε το 'alphabetic').
 */
function emitSpanDecorations(
  out: Entity[], ctx: DerivedContext, span: TextLayoutSpan,
  x: number, y: number, em: number, baselineVOffset: number,
): void {
  const { UNDERLINE_EM, OVERLINE_EM, STRIKETHROUGH_EM, THICKNESS_EM } = TEXT_DECORATION_RATIOS;
  const thickness = em * THICKNESS_EM;
  const width = span.widthWorld;
  const rows: Array<[boolean, number]> = [
    [span.decoration.underline, UNDERLINE_EM],
    [span.decoration.overline, OVERLINE_EM],
    [span.decoration.strikethrough, STRIKETHROUGH_EM],
  ];
  for (const [active, ratio] of rows) {
    if (!active) continue;
    const rect = makeDecorationRect(ctx, x, y + em * (ratio - baselineVOffset), width, thickness);
    if (rect) out.push(rect);
  }
}

/** ΕΝΑ span → glyph μονάδες + διακοσμήσεις, στο τοπικό (y-down) frame του κειμένου. */
function emitSpan(
  out: Entity[], ctx: DerivedContext, span: TextLayoutSpan, x: number, y: number,
  baseline: CanvasTextBaseline, resolved: ResolvedFont | null,
): void {
  const em = emSizeForTextHeight(span.heightWorld, resolved);
  if (resolved && span.text.trim() !== '') {
    // ADR-635 Φ C.26 — anchor → baseline από το SSoT (world y-up), αρνητικό για το y-down
    // τοπικό frame: το ΙΔΙΟ βήμα με το `drawGlyphRunToCanvas` (glyphs ≡ explode γεωμετρία).
    const m = measureText(resolved.font, span.text, em);
    const baselineY = y - baselineOffsetFromAnchor(baseline, { ascent: m.ascent, descent: m.descent });
    const tracking = span.style.tracking != null && span.style.tracking > 0 ? span.style.tracking : 1;
    const tolerance = span.heightWorld / CHORD_TOLERANCE_DIVISOR;
    for (const path of glyphPathsOf(resolved.font, span.text, x, baselineY, em, tracking)) {
      out.push(...glyphToEntities(ctx, path, tolerance));
    }
  }
  if (hasAnyDecoration(span.decoration)) {
    // ADR-635 Φ C.26 — ίδιο re-basing με το `paintLayoutSpan`: πού κάθεται το origin μέσα στη
    // ζώνη ascent→descent της γραμματοσειράς (0=ascent, 0.5=middle, 1=descent, baseline=asc÷band).
    const s = span.style;
    const ink = measureTextGlyphInk(span.text, { fontFamily: s.fontFamily, bold: s.bold, italic: s.italic });
    const baselineVOffset = anchorBandFraction(baseline, { ascent: ink.fontAscent, descent: ink.fontDescent });
    emitSpanDecorations(out, ctx, span, x, y, em, baselineVOffset);
  }
}

/**
 * EXPLODE ενός TEXT/MTEXT στα glyph περιγράμματά του (στάδιο 1 — βλ. κεφαλίδα), ή `null`
 * όταν δεν γίνεται (γραμματοσειρά χωρίς outlines, κενό κείμενο) ώστε ο δρομολογητής να
 * κάνει no-op — το ίδιο συμβόλαιο με κάθε άλλη μη-explodable οντότητα.
 */
export function explodeTextEntity(entity: TextEntity | MTextEntity): Entity[] | null {
  const dxfText = toDxfText(entity);
  const height = dxfText.height;
  const layout = layoutTextBlock(dxfText, height, advanceStyleOf(dxfText));
  const fonts = resolveLayoutFonts(layout);
  if (!fonts) return null;

  const baseline: CanvasTextBaseline = dxfText.textStyle?.textBaseline ?? 'top';
  const align = dxfText.textStyle?.textAlign ?? 'left';
  // ADR-635 Φ C.26 — προς τα πού μεγαλώνει το πολύγραμμο μπλοκ: από το SSoT ('alphabetic' → 'B').
  const row = verticalAnchorToRow(baseline);
  const ctx: DerivedContext = {
    frame: worldFrameOf(dxfText),
    styleBase: inheritEntityStyle(entity as Entity) as Record<string, unknown>,
    layerId: entity.layerId,
  };

  const out: Entity[] = [];
  // Ίδια κατακόρυφη τοποθέτηση με τον renderer: πρώτη γραμμή στο −topAdd·height, κάθε
  // επόμενη πέφτει κατά ΤΟ ΔΙΚΟ ΤΗΣ διάστιχο (`\ps` ανά παράγραφο — ADR-635 Φ C.21 Δ).
  let y = -resolveMultilineExtentsFromExtra(row, totalExtraLineRatio(layout)).topAdd * height;
  for (let i = 0; i < layout.length; i++) {
    const line = layout[i];
    if (i > 0) y += line.spacingRatio * height;
    // Στοίχιση γραμμής (αγκύρωση L/C/R) + στοίχιση παραγράφου (`xOffsetWorld`) — η ίδια
    // σειρά εφαρμογής με το `paintLayoutLines` του renderer.
    const xLine = (align === 'center' ? -line.widthWorld / 2 : align === 'right' ? -line.widthWorld : 0)
      + line.xOffsetWorld;
    for (const span of line.spans) {
      emitSpan(out, ctx, span, xLine + span.xWorld, y, baseline, fonts.get(fontKeyOf(span)) ?? null);
    }
  }
  return out.length > 0 ? out : null;
}
