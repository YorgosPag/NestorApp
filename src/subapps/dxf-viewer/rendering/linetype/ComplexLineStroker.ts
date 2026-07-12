/**
 * ComplexLineStroker — ADR-642 §6.4 (Φ1: stroke geometry SSoT).
 *
 * Ο ΜΟΝΑΔΙΚΟΣ τόπος complex stroking. Δέχεται μια polyline σε **screen-space** +
 * έναν `ComplexLinetypeDef` και:
 *   - Fast-path: αν ο τύπος είναι simple-expressible (native `setLineDash` αρκεί),
 *     επαναχρησιμοποιεί το υπάρχον `dashMmToScreenPx` → μηδέν performance regression
 *     για τους 99% κοινούς τύπους.
 *   - Complex-path: arc-length walk του path, τοποθετώντας dashes/dots με caps (#5),
 *     join (#6), corner policy break/bypass (#7), σταθερό/μεταβλητό πλάτος (#8),
 *     phase (#10) και scale-space model/paper (#11). Compound layers (#9) = ανά layer.
 *
 * Text (#2) / symbols (#3/#4) ορίζονται στο μοντέλο αλλά αποδίδονται σε Φ2/Φ3 — εδώ
 * τα geometry-only elements σχεδιάζονται· τα υπόλοιπα προσπερνώνται (documented).
 *
 * Καθαρή συνάρτηση (points+def+opts → draw) → cacheable στο ADR-040 bitmap path· το
 * cache key ΔΕΝ εξαρτάται από hover/selection (ADR-040 #3).
 */

import { dashMmToScreenPx } from '../linetype-dash-resolver';
import {
  complexToPattern,
  effectiveScaleSpace,
  isSimpleExpressible,
} from '../../config/complex-linetype-adapters';
import type {
  ComplexLinetypeDef,
  DashCap,
  StrokeLayer,
  SymbolElement,
  TextElement,
} from '../../config/complex-linetype-types';
import {
  drawDot,
  fillTaperedDash,
  strokeDashSubpath,
  tracePolylinePath,
} from './complex-dash-draw';
import { drawTextElement } from './complex-text-draw';
import { drawSymbolElement } from './complex-symbol-draw';
import {
  buildSegments,
  cumulativeLengths,
  offsetPolyline,
  pointAt,
  polylineVertices,
  sampleSubpath,
  type Point,
  type PolylineVertex,
  type Seg,
} from './complex-stroke-geometry';

/** Screen px ανά mm στο paper scale-space (96 DPI: 25.4mm/inch). */
export const DEFAULT_PAPER_PX_PER_MM = 96 / 25.4;

export interface StrokePolylineOptions {
  /** World→screen factor (το τρέχον zoom) — χρησιμοποιείται στο model scale-space. */
  readonly worldToScreenScale: number;
  /** Global LTSCALE (`LinetypeScaleStore`). */
  readonly ltscale: number;
  /** Per-object CELTSCALE (entity `ltscale`, default 1). */
  readonly celtscale?: number;
  /** Screen px ανά mm στο paper scale-space (default `DEFAULT_PAPER_PX_PER_MM`). */
  readonly paperPxPerMm?: number;
  /** Κλειστή polyline (πολύγωνο). */
  readonly closed?: boolean;
}

/** Μία εγγραφή του κύκλου σχεδίασης — geometry/text/symbol element σε px. */
interface CycleEntry {
  readonly kind: 'dash' | 'gap' | 'dot' | 'text' | 'symbol';
  readonly lengthPx: number;
  readonly widthPx: number;
  readonly cap?: DashCap;
  readonly widthProfile?: readonly number[];
  /** Το embedded-text element (μόνο για `kind === 'text'`, ADR-642 Φ2). */
  readonly text?: TextElement;
  /** Το embedded-symbol element (μόνο για `kind === 'symbol'`, ADR-642 Φ3). */
  readonly symbol?: SymbolElement;
}

/** mm→px factor ανάλογα με το scale-space (× LTSCALE × CELTSCALE). */
function resolveMmToPx(def: ComplexLinetypeDef, opts: StrokePolylineOptions): number {
  const base =
    effectiveScaleSpace(def) === 'paper'
      ? opts.paperPxPerMm ?? DEFAULT_PAPER_PX_PER_MM
      : opts.worldToScreenScale;
  return base * opts.ltscale * (opts.celtscale ?? 1);
}

/** Ζωγραφίζει μια συνεχή polyline (χωρίς dash) — fallback/solid helper. */
function strokePolyline(ctx: CanvasRenderingContext2D, pts: readonly Point[]): void {
  if (pts.length < 2) return;
  tracePolylinePath(ctx, pts);
  ctx.stroke();
}

/** Fast-path: αναγωγή σε native `setLineDash` (μηδέν regression). */
function fastStroke(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  def: ComplexLinetypeDef,
  opts: StrokePolylineOptions,
): void {
  const pattern = complexToPattern(def) ?? [];
  const base =
    effectiveScaleSpace(def) === 'paper'
      ? opts.paperPxPerMm ?? DEFAULT_PAPER_PX_PER_MM
      : opts.worldToScreenScale;
  const dashPx = dashMmToScreenPx(pattern, base, opts.ltscale, opts.celtscale ?? 1);
  ctx.save();
  ctx.setLineDash(dashPx);
  if (def.join) ctx.lineJoin = def.join;
  strokePolyline(ctx, pts);
  ctx.restore();
}

/** Geometry + text elements → draw cycle (px). Symbol elements προσπερνώνται (Φ3). */
function buildCycle(layer: StrokeLayer, mmToPx: number, baseWidthPx: number): CycleEntry[] {
  const cycle: CycleEntry[] = [];
  for (const el of layer.elements) {
    if (el.kind === 'dash') {
      cycle.push({
        kind: 'dash',
        lengthPx: Math.max(el.lengthMm * mmToPx, 0),
        widthPx: el.widthMm != null ? el.widthMm * mmToPx : baseWidthPx,
        cap: el.cap,
        widthProfile: el.widthProfile,
      });
    } else if (el.kind === 'gap') {
      cycle.push({ kind: 'gap', lengthPx: Math.max(el.lengthMm * mmToPx, 0), widthPx: baseWidthPx });
    } else if (el.kind === 'dot') {
      cycle.push({ kind: 'dot', lengthPx: 0, widthPx: baseWidthPx, cap: el.cap });
    } else if (el.kind === 'text') {
      // Text occupies a ZERO-length slot (AutoCAD-faithful) — drawn at the cursor, the
      // surrounding gaps make its room. X/Y offset + scale/rotation live in `drawTextElement`.
      cycle.push({ kind: 'text', lengthPx: 0, widthPx: baseWidthPx, text: el });
    } else if (el.kind === 'symbol' && el.role === 'side') {
      // Only `side` symbols ride the arc-length cycle (zero-length slot, `.shx` shape
      // convention) — the glyph is stamped at the cursor. Corner/start/end roles (#4) are
      // placed at vertices by `stampCornerSymbols`, NOT along the walk (ADR-642 Φ4).
      cycle.push({ kind: 'symbol', lengthPx: 0, widthPx: baseWidthPx, symbol: el });
    }
  }
  return cycle;
}

/** Θετικό modulo (για shift φάσης με αρνητικό phase). */
function posMod(v: number, m: number): number {
  return m > 0 ? ((v % m) + m) % m : 0;
}

/** Arc-length walk πάνω σε ένα σύνολο τμημάτων, τοποθετώντας τον κύκλο στοιχείων. */
function walkPath(
  ctx: CanvasRenderingContext2D,
  segs: readonly Seg[],
  cycle: readonly CycleEntry[],
  cycleLenPx: number,
  phasePx: number,
  mmToPx: number,
): void {
  const cum = cumulativeLengths(segs);
  const total = cum[cum.length - 1];
  if (total <= 0 || cycleLenPx <= 0) return;
  const maxMarks = Math.ceil((total / cycleLenPx + 2) * cycle.length) + 8;
  let dist = -posMod(phasePx, cycleLenPx);
  let i = 0;
  for (let guard = 0; dist < total && guard < maxMarks; guard++, i++) {
    const el = cycle[i % cycle.length];
    if (el.kind === 'dot') {
      if (dist >= 0 && dist <= total) drawDot(ctx, pointAt(segs, cum, dist), el.widthPx, el.cap);
      continue;
    }
    if (el.kind === 'text') {
      // Zero-length slot (like a dot): draw at the cursor, no advance. ADR-642 Φ2 (#2).
      if (el.text && dist >= 0 && dist <= total) {
        drawTextElement(ctx, el.text, pointAt(segs, cum, dist), mmToPx);
      }
      continue;
    }
    if (el.kind === 'symbol') {
      // Zero-length slot (like text): stamp the glyph at the cursor, no advance. ADR-642 Φ3 (#3).
      if (el.symbol && dist >= 0 && dist <= total) {
        drawSymbolElement(ctx, el.symbol, pointAt(segs, cum, dist), mmToPx);
      }
      continue;
    }
    const start = dist;
    dist += el.lengthPx;
    if (el.kind === 'gap') continue;
    const ds = Math.max(start, 0);
    const de = Math.min(dist, total);
    if (de <= ds) continue;
    const sp = sampleSubpath(segs, cum, ds, de);
    if (el.widthProfile) fillTaperedDash(ctx, sp, el.widthPx, el.widthProfile);
    else strokeDashSubpath(ctx, sp, el.widthPx, el.cap);
  }
}

/** Arc-length offset (px) μέσα στον κύκλο όπου ξεκινά το πρώτο ορατό dash — 0 αν κανένα. */
function firstDashOffsetPx(cycle: readonly CycleEntry[]): number {
  let offset = 0;
  for (const el of cycle) {
    if (el.kind === 'dash') return offset;
    offset += el.lengthPx;
  }
  return 0;
}

/** Κάτω από αυτό το |turn| μια κορυφή είναι συγγραμμική → ούτε inner ούτε outer γωνία. */
const CORNER_TURN_EPS = 1e-6;

/** Ανήκει ένα corner-role σύμβολο σε αυτή την κορυφή; (ADR-642 Φ4 role→vertex mapping.) */
function roleMatchesVertex(role: SymbolElement['role'], v: PolylineVertex): boolean {
  switch (role) {
    case 'start':
      return v.role === 'start';
    case 'end':
      return v.role === 'end';
    case 'innerCorner':
      return v.role === 'interior' && v.turn > CORNER_TURN_EPS;
    case 'outerCorner':
      return v.role === 'interior' && v.turn < -CORNER_TURN_EPS;
    default:
      return false; // 'side' → ζωγραφίζεται από τον walk, ποτέ εδώ
  }
}

/**
 * Stamp-άρει corner/start/end σύμβολα (#4) στις κορυφές της polyline — πέρασμα ΟΡΘΟΓΩΝΙΟ
 * στον arc-length walk: inner/outer glyphs στις κοίλες/κυρτές κορυφές, start/end στα άκρα.
 * Τα glyphs προσανατολίζονται κατά τη διχοτόμο της κορυφής (ή την εφαπτομένη του άκρου).
 * No-op όταν το layer δεν έχει non-`side` σύμβολο (ο κοινός τύπος → μηδέν overhead).
 */
function stampCornerSymbols(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  layer: StrokeLayer,
  mmToPx: number,
  closed: boolean,
): void {
  const cornerSyms = layer.elements.filter(
    (e): e is SymbolElement => e.kind === 'symbol' && e.role !== 'side',
  );
  if (cornerSyms.length === 0) return;
  const verts = polylineVertices(pts, closed);
  for (const v of verts) {
    for (const sym of cornerSyms) {
      if (roleMatchesVertex(sym.role, v)) {
        drawSymbolElement(ctx, sym, { x: v.x, y: v.y, ux: v.ux, uy: v.uy }, mmToPx);
      }
    }
  }
}

/** Στρώνει ένα layer (μη-simple): build cycle → walk (break/alignDash ανά τμήμα, αλλιώς συνεχές) → corner symbols. */
function strokeLayer(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  def: ComplexLinetypeDef,
  layer: StrokeLayer,
  mmToPx: number,
  closed: boolean,
): void {
  const baseWidthPx = layer.widthMm != null ? layer.widthMm * mmToPx : ctx.lineWidth;
  const cycle = buildCycle(layer, mmToPx, baseWidthPx);
  const cycleLenPx = cycle.reduce((s, e) => s + e.lengthPx, 0);
  if (cycle.length === 0 || cycleLenPx <= 0) {
    strokePolyline(ctx, pts); // degenerate → solid fallback (never blank a line)
  } else {
    const segs = buildSegments(pts, closed);
    if (def.cornerPolicy === 'break') {
      const phasePx = (def.phaseMm ?? 0) * mmToPx;
      for (const s of segs) walkPath(ctx, [s], cycle, cycleLenPx, phasePx, mmToPx);
    } else if (def.cornerPolicy === 'alignDash') {
      // Per-segment walk (σαν break) αλλά phased ώστε ένα DASH — όχι κενό — να ξεκινά σε κάθε
      // κορυφή (MicroStation "align dashes to corners"). Παρακάμπτει το user phase. #7.
      const alignPhasePx = firstDashOffsetPx(cycle);
      for (const s of segs) walkPath(ctx, [s], cycle, cycleLenPx, alignPhasePx, mmToPx);
    } else {
      const phasePx = (def.phaseMm ?? 0) * mmToPx;
      walkPath(ctx, segs, cycle, cycleLenPx, phasePx, mmToPx);
    }
  }
  stampCornerSymbols(ctx, pts, layer, mmToPx, closed);
}

/**
 * Στρώνει μια screen-space polyline με έναν complex linetype. ΜΟΝΑΔΙΚΟ SSoT complex
 * stroking (entity/dim/BIM renderers το καλούν on-touch, δεν το re-implement — §8).
 */
export function strokeStyledPolyline(
  ctx: CanvasRenderingContext2D,
  screenPoints: readonly Point[],
  def: ComplexLinetypeDef,
  opts: StrokePolylineOptions,
): void {
  if (screenPoints.length < 2) return;
  if (isSimpleExpressible(def)) {
    fastStroke(ctx, screenPoints, def, opts);
    return;
  }
  const mmToPx = resolveMmToPx(def, opts);
  const closed = opts.closed ?? false;
  ctx.save();
  if (def.join) ctx.lineJoin = def.join;
  if (def.miterLimit != null) ctx.miterLimit = def.miterLimit;
  for (const layer of def.layers) {
    const pts = layer.offsetMm ? offsetPolyline(screenPoints, layer.offsetMm * mmToPx) : screenPoints;
    strokeLayer(ctx, pts, def, layer, mmToPx, closed);
  }
  ctx.restore();
}
