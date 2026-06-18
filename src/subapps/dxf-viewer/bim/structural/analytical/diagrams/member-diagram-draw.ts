/**
 * Member diagram draw — pure canvas primitives (ADR-483, T3-UI / Slice 4).
 *
 * Σχεδιάζει τη διαδρομή διαγράμματος ενός μέλους **σε screen space**: ο overlay
 * προβάλλει τα άκρα i/j σε οθόνη (`worldToScreen`), εδώ γίνεται το offset κάθετα
 * στον άξονα κατά `value · pxScale` (σταθερό pixel ύψος, zoom-stable — όπως τα
 * Robot results overlays). Καμπύλη + translucent γέμισμα + baseline + ετικέτα
 * ακραίας τιμής σε pill (reuse `canvas-pill` SSoT).
 *
 * Pure — no React, no stores (ADR-040 compliant). Μηδέν μετρικά εδώ — όλα έρχονται
 * έτοιμα από `member-diagram-geometry`.
 *
 * @see ./member-diagram-geometry.ts — η πηγή των διαδρομών
 * @see ../../../../rendering/utils/canvas-pill.ts — pill SSoT
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../../../rendering/utils/canvas-pill';
import type { MemberDiagramPath, DiagramSample } from './member-diagram-geometry';

/** Χρωματικό στυλ ανά εντατικό μέγεθος (stroke + translucent fill). */
export interface DiagramDrawStyle {
  readonly stroke: string;
  readonly fill: string;
  /**
   * ADR-483 Slice 4b — όταν οριστεί, το γέμισμα **χωρίζεται στα zero-crossings**
   * (ζώνες εφελκυσμού/θλίψης): θετικές τιμές → `fill` (θερμό, sagging → εφελκ.
   * κάτω ίνα), αρνητικές → `fillNegative` (ψυχρό, hogging → εφελκ. άνω ίνα). Μόνο
   * για ροπή — η V/N κρατά μονόχρωμο γέμισμα (`fill`).
   */
  readonly fillNegative?: string;
}

/** Επιλογές σχεδίασης διαγράμματος (ADR-483 Slice 4b). */
export interface DiagramDrawOptions {
  /**
   * Caution (αστάθεια): αμπέρ **διακεκομμένη** καμπύλη χωρίς γέμισμα — οι τιμές του
   * συνδυασμού είναι ύποπτες (singular K). Robot «unreliable results».
   */
  readonly dashed?: boolean;
}

const LABEL_FONT = '11px sans-serif';
const ZONE_FONT = '10px sans-serif';
const PILL_PAD_X = 5;
const PILL_HEIGHT = 16;
const CURVE_WIDTH = 1.25;
const BASELINE_WIDTH = 0.75;
/** Μήκος διακεκομμένης (caution) σε px. */
const CAUTION_DASH: readonly number[] = [5, 4];
/** Μικρή απόσταση (px) της ετικέτας ζώνης T/C από τον άξονα του μέλους. */
const ZONE_LABEL_GAP_PX = 11;
/**
 * Οριζόντια μετατόπιση (κλάσμα μήκους) της ετικέτας ζώνης T/C **μακριά από την
 * κορυφή** — εκεί κάθεται το value pill· έτσι «εφελκ. κάτω» δεν συμπίπτει με το
 * «16,7 kNm». Μετατόπιση προς το πλησιέστερο άκρο (μένει εντός μέλους).
 */
const ZONE_LABEL_SHIFT_FRAC = 0.24;
/** Ακτίνα (px) του δείκτη σημείου μηδενισμού (M=0). */
const INFLECTION_RADIUS = 3.4;
const INFLECTION_FILL = '#ffffff';
const INFLECTION_STROKE = 'rgba(40,44,52,0.9)';

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Μοναδιαίο κάθετο διάνυσμα (screen space) στον άξονα i→j. */
function perpUnit(i: Point2D, j: Point2D): Point2D {
  const dx = j.x - i.x;
  const dy = j.y - i.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Σημείο offset μιας στάθμης: βάση στον άξονα + κάθετο · value · κλίμακα. */
function offsetPoint(
  si: Point2D,
  sj: Point2D,
  normal: Point2D,
  sample: DiagramSample,
  pxScale: number,
): Point2D {
  const base = lerp(si, sj, sample.f);
  return { x: base.x + normal.x * sample.value * pxScale, y: base.y + normal.y * sample.value * pxScale };
}

/**
 * Smooth path μέσα από τα σημεία `pts` με midpoint quadratic-bezier (η πένα
 * θεωρείται ήδη στο `pts[0]`). Περνά ακριβώς από τα άκρα `pts[0]`/`pts[last]` και
 * εξομαλύνει τα ενδιάμεσα → η parabola της UDL ροπής φαίνεται ομαλή (όχι σπασμένη
 * polyline) χωρίς αλλαγή στις σταθμές του solver. <3 σημεία → ευθείες (fallback).
 */
function buildSmoothThrough(ctx: CanvasRenderingContext2D, pts: readonly Point2D[]): void {
  if (pts.length < 3) {
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k]!.x, pts[k]!.y);
    return;
  }
  let i = 1;
  for (; i < pts.length - 2; i++) {
    const xc = (pts[i]!.x + pts[i + 1]!.x) / 2;
    const yc = (pts[i]!.y + pts[i + 1]!.y) / 2;
    ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, xc, yc);
  }
  ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y);
}

/** Κλειστό τρίγωνο/τετράπλευρο γεμισμένο με `color` (T/C ζώνη — segment quad). */
function fillPolygon(ctx: CanvasRenderingContext2D, points: readonly Point2D[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Μονόχρωμο γέμισμα (V/N): axis-start → ομαλή καμπύλη → axis-end → close. */
function fillSingleRibbon(
  ctx: CanvasRenderingContext2D, si: Point2D, sj: Point2D, pts: readonly Point2D[], color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(si.x, si.y);
  ctx.lineTo(pts[0]!.x, pts[0]!.y);
  buildSmoothThrough(ctx, pts);
  ctx.lineTo(sj.x, sj.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Γέμισμα ζωνών T/C (ροπή): ανά τμήμα μεταξύ διαδοχικών σταθμών, quad
 * [baseA, ptA, ptB, baseB] με χρώμα ανά πρόσημο· σε zero-crossing σπάει στον άξονα
 * (όπου value=0 → offset=base) σε δύο τρίγωνα. `posColor` = εφελκ. κάτω, `negColor` = άνω.
 */
function fillSignedRibbon(
  ctx: CanvasRenderingContext2D, si: Point2D, sj: Point2D,
  pts: readonly Point2D[], samples: readonly DiagramSample[], posColor: string, negColor: string,
): void {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = samples[k]!, b = samples[k + 1]!;
    const baseA = lerp(si, sj, a.f), baseB = lerp(si, sj, b.f);
    if (a.value >= 0 && b.value >= 0) { fillPolygon(ctx, [baseA, pts[k]!, pts[k + 1]!, baseB], posColor); continue; }
    if (a.value <= 0 && b.value <= 0) { fillPolygon(ctx, [baseA, pts[k]!, pts[k + 1]!, baseB], negColor); continue; }
    const t = Math.abs(a.value) / (Math.abs(a.value) + Math.abs(b.value));
    const baseCross = lerp(si, sj, a.f + (b.f - a.f) * t);
    fillPolygon(ctx, [baseA, pts[k]!, baseCross], a.value >= 0 ? posColor : negColor);
    fillPolygon(ctx, [baseCross, pts[k + 1]!, baseB], b.value >= 0 ? posColor : negColor);
  }
}

/** Άξονας μέλους (baseline) — λεπτή ευθεία i→j. */
function strokeBaseline(ctx: CanvasRenderingContext2D, si: Point2D, sj: Point2D, stroke: string): void {
  ctx.beginPath();
  ctx.moveTo(si.x, si.y);
  ctx.lineTo(sj.x, sj.y);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = BASELINE_WIDTH;
  ctx.setLineDash([]);
  ctx.stroke();
}

/**
 * Σχεδίασε το διάγραμμα ενός μέλους: γέμισμα (μονόχρωμο ή ζώνες T/C ανά πρόσημο) +
 * ομαλή καμπύλη + baseline. `si`/`sj` = άκρα i/j σε οθόνη· `pxScale` = px ανά μονάδα
 * τιμής. `options.dashed` ⇒ caution: αμπέρ διακεκομμένη καμπύλη ΧΩΡΙΣ γέμισμα.
 */
export function drawMemberDiagram(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  pxScale: number,
  style: DiagramDrawStyle,
  options: DiagramDrawOptions = {},
): void {
  const normal = perpUnit(si, sj);
  const pts = path.samples.map((s) => offsetPoint(si, sj, normal, s, pxScale));
  if (pts.length === 0) return;

  if (!options.dashed) {
    if (style.fillNegative) fillSignedRibbon(ctx, si, sj, pts, path.samples, style.fill, style.fillNegative);
    else fillSingleRibbon(ctx, si, sj, pts, style.fill);
  }

  // Smooth diagram curve (διακεκομμένη όταν caution).
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  buildSmoothThrough(ctx, pts);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = CURVE_WIDTH;
  ctx.setLineDash(options.dashed ? [...CAUTION_DASH] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  strokeBaseline(ctx, si, sj, style.stroke);
}

/** Ακραίο δείγμα δοθέντος προσήμου (max θετικό / min αρνητικό) ή null αν λείπει. */
function signedExtremum(samples: readonly DiagramSample[], positive: boolean): DiagramSample | null {
  let best: DiagramSample | null = null;
  for (const s of samples) {
    if (positive ? s.value > 0 : s.value < 0) {
      if (!best || (positive ? s.value > best.value : s.value < best.value)) best = s;
    }
  }
  return best;
}

/** Μικρή ετικέτα ζώνης T/C (χωρίς pill — ελαφριά), λίγο έξω από τον άξονα. */
function drawZoneTag(ctx: CanvasRenderingContext2D, anchor: Point2D, outward: Point2D, text: string, color: string): void {
  ctx.font = ZONE_FONT;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, anchor.x + outward.x * ZONE_LABEL_GAP_PX, anchor.y + outward.y * ZONE_LABEL_GAP_PX);
}

/** f της ετικέτας ζώνης: μετατόπιση από την κορυφή προς το πλησιέστερο άκρο. */
function zoneLabelF(peakF: number): number {
  const shifted = peakF <= 0.5 ? peakF + ZONE_LABEL_SHIFT_FRAC : peakF - ZONE_LABEL_SHIFT_FRAC;
  return Math.min(0.92, Math.max(0.08, shifted));
}

/**
 * ADR-483 Slice 4b — ετικέτες ζωνών εφελκυσμού (μόνο ροπή). Ο **caller** ορίζει την
 * αντιστοίχιση πρόσημο→ετικέτα/χρώμα (calibration ανά σύμβαση solver): `posLabel/posColor`
 * για τη ζώνη **θετικής** τιμής, `negLabel/negColor` για **αρνητικής**. Αγκυρώνονται στον
 * **άξονα του μέλους** + οριζόντια μετατόπιση από την κορυφή → δεν συμπίπτουν με το value
 * pill. Η θετική ετικέτα μπαίνει screen-up, η αρνητική screen-down (ανεξ. προσανατολισμού).
 */
export function drawTensionZoneLabels(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  posLabel: string,
  posColor: string,
  negLabel: string,
  negColor: string,
): void {
  const normal = perpUnit(si, sj);
  const down = normal.y >= 0 ? normal : { x: -normal.x, y: -normal.y };
  const up = { x: -down.x, y: -down.y };
  const pos = signedExtremum(path.samples, true);
  const neg = signedExtremum(path.samples, false);
  if (pos) drawZoneTag(ctx, lerp(si, sj, zoneLabelF(pos.f)), up, posLabel, posColor);
  if (neg) drawZoneTag(ctx, lerp(si, sj, zoneLabelF(neg.f)), down, negLabel, negColor);
}

/** Τιμή σε pill σε σημείο οθόνης `p`. `unit` = SI σύμβολο. */
function drawValuePill(ctx: CanvasRenderingContext2D, p: Point2D, value: number, unit: string): void {
  const text = `${value.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ${unit}`;
  ctx.font = LABEL_FONT;
  const boxW = ctx.measureText(text).width + PILL_PAD_X * 2;
  pillPath(ctx, p.x - boxW / 2, p.y - PILL_HEIGHT / 2, boxW, PILL_HEIGHT, 3);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = contrastTextColor(PILL_BG_COLOR);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, p.y);
}

/** True όταν η ακραία τιμή είναι στο **εσωτερικό** (όχι στα άκρα — εκεί την δείχνουν τα end pills). */
function isInteriorExtremum(f: number): boolean {
  return f > 0.02 && f < 0.98;
}

/**
 * Ετικέτα της **ακραίας τιμής στο άνοιγμα** (max-abs ανάμεσα στις εσωτερικές στάθμες)
 * σε pill — π.χ. η ροπή ανοίγματος (sagging) σε πλαισιακό δοκάρι, που διαφέρει από τις
 * ροπές στήριξης. Τα **άκρα** τα δείχνει το {@link drawDiagramEndValues} → μηδέν διπλό
 * pill. `unit` = SI σύμβολο.
 */
export function drawDiagramExtremum(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  pxScale: number,
  unit: string,
): void {
  let best: DiagramSample | null = null;
  for (const s of path.samples) {
    if (!isInteriorExtremum(s.f)) continue;
    if (!best || Math.abs(s.value) > Math.abs(best.value)) best = s;
  }
  if (!best) return;
  const normal = perpUnit(si, sj);
  drawValuePill(ctx, offsetPoint(si, sj, normal, best, pxScale), best.value, unit);
}

/**
 * ADR-483 Slice 4b+ — τιμές στα **άκρα** του μέλους (M_i / M_j) σε pills, πάνω στην
 * καμπύλη στις στάθμες f=0 και f=1 (Robot/SAP end values — ροπές στήριξης σε συνεχή
 * δοκό). Δείχνει όποιο εντατικό μέγεθος σχεδιάζεται (M/V/N).
 */
export function drawDiagramEndValues(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  pxScale: number,
  unit: string,
): void {
  const normal = perpUnit(si, sj);
  const first = path.samples[0];
  const last = path.samples[path.samples.length - 1];
  if (first) drawValuePill(ctx, offsetPoint(si, sj, normal, first, pxScale), first.value, unit);
  if (last && last !== first) drawValuePill(ctx, offsetPoint(si, sj, normal, last, pxScale), last.value, unit);
}

/**
 * ADR-483 Slice 4b+ — σημεία μηδενισμού του εντατικού μεγέθους (M=0 inflection /
 * σημεία αλλαγής προσήμου): μικρός λευκός κύκλος **στον άξονα** του μέλους (όπου
 * value=0 → offset=base) σε κάθε αλλαγή προσήμου. Χρήσιμο για διακοπή ράβδων.
 */
export function drawInflectionMarkers(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
): void {
  for (let k = 0; k < path.samples.length - 1; k++) {
    const a = path.samples[k]!;
    const b = path.samples[k + 1]!;
    if ((a.value > 0) === (b.value > 0) || a.value === 0 || b.value === 0) continue;
    const t = Math.abs(a.value) / (Math.abs(a.value) + Math.abs(b.value));
    const p = lerp(si, sj, a.f + (b.f - a.f) * t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, INFLECTION_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = INFLECTION_FILL;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INFLECTION_STROKE;
    ctx.setLineDash([]);
    ctx.stroke();
  }
}
