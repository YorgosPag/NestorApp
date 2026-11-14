/**
 * ADR-941 Φ2α · Φ2β — **ποια γραμμένη τιμή μετρά ποια σημεία** στο διανυσματικό PDF. Καθαρό, σε px της σελίδας (ένας χώρος
 * για γεωμετρία και κείμενα, πριν από τη σκηνή).
 *
 * 🔑 **Δ10 — τι είναι διάσταση:** κείμενο που διαβάζεται ως μήκος (`parseDimensionValue`, ο ΕΝΑΣ αναγνώστης τιμών· μονάδα σκέτου
 *   ακεραίου από **όλα** τα κείμενα διαστάσεων της σελίδας) **και** δένεται. Οτιδήποτε άλλο μένει κείμενο.
 * 🔑 **Δ17/Δ18 (Φ2β) — πρώτα τα σχεδιασμένα γραφικά:** τιμή με γραμμή διάστασης και δύο απολήξεις της βιβλιοθήκης
 *   (`pdf-vector-dimension-graphics`) μετρά τις κορυφές στις οποίες δείχνουν οι μύτες (`pdf-vector-measured-points`). Τα
 *   γραφικά της **βγαίνουν** από τις υποψήφιες ακμές της Φ2α και, όταν είναι ολόκληρες πολυγραμμές, **απορροφώνται** (Δ19).
 * 🔑 **Δ11 (Φ2α) — χωρίς γραφικά:** υποψήφιες ακμές παράλληλες με τη γραμμή βάσης, με το κέντρο του κειμένου σε λίγα em
 *   κάθετα και την προβολή του **μέσα** στην ακμή. Το βάρος πέφτει με την απόσταση (σε em).
 * 🔑 **Δ12 — μία συναίνεση κλίμακας για όλες:** ψήφος = μήκος / τιμή, η **ίδια** μηχανή με τον ADR-929 (`scale-consensus`).
 *   Οι σχεδιασμένες ψηφίζουν με το ένα τους άνοιγμα. Αμφίσημο χωρίς συναίνεση ⇒ **αδέσμευτο**, μετρημένο — ποτέ μαντεψιά.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-dimension-binding
 */

import type { PdfVectorContent, PdfVectorPolyline, PdfVectorText, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import {
  classifyWrittenText,
  inferBareIntegerUnit,
  parseDimensionValue,
} from '../../bim/plan-recognition/reading/written-values';
import {
  agreeingCandidate,
  dimensionScaleConsensus,
  type ScaleVoteCandidate,
  type ScaleVoteTarget,
} from '../../bim/plan-recognition/fusion/scale-consensus';
import { DEFAULT_PLAN_FUSION } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import { PDF_VECTOR_DIMENSION_GRAPHICS_LIMITS, PDF_VECTOR_DIMENSION_LIMITS } from '../../config/tolerance-config';
import { cross, distance, dot, midpoint, polylineSegments, segmentGrid, sub, type PdfSegment } from './pdf-vector-segments';
import { textFrame, type TextFrame } from './pdf-vector-text-frame';
import { detectDimensionGraphics, type PdfDimensionGraphic } from './pdf-vector-dimension-graphics';
import { measuredPointsOf, type PdfMeasuredPoint } from './pdf-vector-measured-points';

/** Μια γραμμένη τιμή δεμένη στα δύο σημεία που μετρά. */
export interface PdfDimensionBinding {
  /** Δείκτης στο `content.texts`. */
  readonly textIndex: number;
  readonly raw: string;
  readonly valueMm: number;
  /** Το μέγεθος του τελευταίου γραμμένου ψηφίου, σε mm. */
  readonly precisionMm: number;
  /** Τα δύο μετρούμενα σημεία, με την κορυφή της γεωμετρίας που τα κρατά (συσχέτιση). */
  readonly measured: readonly [PdfMeasuredPoint, PdfMeasuredPoint];
  /** Ένα σημείο της γραμμής διάστασης: η σχεδιασμένη γραμμή (Φ2β) ή το μέσο της γραμμής βάσης του κειμένου (Φ2α). */
  readonly linePoint: PxPoint;
  /** Φ2β — τα μπλοκ των απολήξεων του σχεδίου, ένα ανά άκρο με τη σειρά του `measured`· Φ2α ⇒ `null`. */
  readonly arrowheads: readonly [string, string] | null;
}

export interface PdfDimensionReading {
  readonly bindings: readonly PdfDimensionBinding[];
  /** Η κλίμακα που αποδεικνύουν οι γραμμένες τιμές (px της σελίδας ανά mm), ή `null`. */
  readonly pxPerMm: number | null;
  /** Τιμές μήκους που **δεν** δέθηκαν (καμία ή αμφίσημη ακμή): μένουν κείμενα. */
  readonly unbound: number;
  /** Δ19 — οι πολυγραμμές (δείκτες στο `content.polylines`) που είναι **ολόκληρες** γραφικά δεμένων διαστάσεων. */
  readonly absorbed: ReadonlySet<number>;
}

interface BindingCandidate extends ScaleVoteCandidate {
  readonly measured: readonly [PdfMeasuredPoint, PdfMeasuredPoint];
}

interface TextTarget extends ScaleVoteTarget<BindingCandidate> {
  readonly textIndex: number;
  readonly raw: string;
  readonly dimension: { readonly valueMm: number; readonly precisionMm: number };
  readonly linePoint: PxPoint;
  readonly arrowheads: readonly [string, string] | null;
}

interface DimensionText {
  readonly textIndex: number;
  readonly text: PdfVectorText;
  readonly frame: TextFrame;
  readonly value: { readonly valueMm: number; readonly precisionMm: number };
}

/** Φ2α — η ακμή ως υποψήφιο του κειμένου, ή `null` όταν δεν είναι παράλληλη, κοντινή και «κάτω» από το κείμενο. */
function edgeCandidate(edge: PdfSegment, frame: TextFrame): BindingCandidate | null {
  const w = sub(edge.b, edge.a);
  const wn: PxPoint = [w[0] / edge.length, w[1] / edge.length];
  if (Math.abs(cross(frame.dir, wn)) > PDF_VECTOR_DIMENSION_LIMITS.PARALLEL_SIN) return null;
  const rel = sub(frame.centre, edge.a);
  const offsetEm = Math.abs(cross(wn, rel)) / frame.em;
  if (offsetEm > PDF_VECTOR_DIMENSION_LIMITS.MAX_OFFSET_EM) return null;
  const t = dot(rel, wn);
  if (t < 0 || t > edge.length) return null;
  const measured: [PdfMeasuredPoint, PdfMeasuredPoint] = [
    { point: edge.a, vertex: { polylineIndex: edge.polylineIndex, index: edge.from } },
    { point: edge.b, vertex: { polylineIndex: edge.polylineIndex, index: edge.to } },
  ];
  return { measured, gapPx: edge.length, score: 1 / (1 + offsetEm), readingHits: 0, extensionHits: 0 };
}

/** Μία πλήρης μονάδα του τελευταίου ψηφίου: στρογγυλοποίηση (±½) και περιθώριο σχεδίασης (±½). */
const toleranceOf = (d: DimensionText): number => d.value.precisionMm / d.value.valueMm;

/** Φ2β — η σχεδιασμένη διάσταση ως στόχος με **ένα** υποψήφιο (τα γραφικά δεν αφήνουν αμφισημία). */
function graphicTarget(
  d: DimensionText, g: PdfDimensionGraphic, polylines: readonly PdfVectorPolyline[], excluded: ReadonlySet<number>,
): TextTarget {
  const tol = PDF_VECTOR_DIMENSION_GRAPHICS_LIMITS.ON_LINE_EM * d.frame.em;
  const measured = measuredPointsOf(g.apexes, g.dir, polylines, excluded, tol);
  const gapPx = distance(measured[0].point, measured[1].point);
  const candidate: BindingCandidate = { measured, gapPx, score: 1, readingHits: 0, extensionHits: 2 };
  return {
    textIndex: d.textIndex, raw: d.text.text, dimension: d.value, toleranceRel: toleranceOf(d),
    candidates: gapPx > 0 ? [candidate] : [], linePoint: midpoint(g.apexes[0], g.apexes[1]), arrowheads: g.arrowheads,
  };
}

/** Φ2α — η τιμή χωρίς γραφικά, με υποψήφιες όλες τις κατάλληλες ακμές. */
function edgeTarget(d: DimensionText, edges: readonly PdfSegment[]): TextTarget {
  return {
    textIndex: d.textIndex, raw: d.text.text, dimension: d.value, toleranceRel: toleranceOf(d),
    candidates: edges.flatMap((e) => edgeCandidate(e, d.frame) ?? []), linePoint: d.frame.baselineMid, arrowheads: null,
  };
}

/** Τα κείμενα της σελίδας που διαβάζονται ως μήκος, με το πλαίσιο και την τιμή τους. */
function dimensionTexts(content: PdfVectorContent): DimensionText[] {
  const lengthTexts = content.texts.filter((t) => classifyWrittenText(t.text) === 'dimension');
  const unit = inferBareIntegerUnit(lengthTexts.map((t) => t.text));
  return content.texts.flatMap((text, textIndex) => {
    if (classifyWrittenText(text.text) !== 'dimension') return [];
    const value = parseDimensionValue(text.text, unit);
    const frame = value ? textFrame(text) : null;
    return value && frame ? [{ textIndex, text, frame, value: { valueMm: value.valueMm, precisionMm: value.precisionMm } }] : [];
  });
}

/** Οι πολυγραμμές που αγγίζουν τα γραφικά (καμία δεν μετρά) και όσες είναι **ολόκληρες** γραφικά (απορροφώνται). */
function graphicPolylines(graphics: readonly PdfDimensionGraphic[], segments: readonly PdfSegment[]): {
  readonly touched: ReadonlySet<number>; readonly absorbed: ReadonlySet<number>;
} {
  const claimed = new Set(graphics.flatMap((g) => g.segmentIds));
  const touched = new Set(segments.filter((s) => claimed.has(s.id)).map((s) => s.polylineIndex));
  const absorbed = new Set([...touched].filter((p) => segments.every((s) => s.polylineIndex !== p || claimed.has(s.id))));
  return { touched, absorbed };
}

/** Τα σημεία του στόχου: της κλίμακας, αλλιώς το μόνο υποψήφιο· αμφίσημο ⇒ `undefined`. */
function chosen(target: TextTarget, pxPerMm: number | null): BindingCandidate | undefined {
  const agreeing = pxPerMm === null ? undefined : agreeingCandidate(target, pxPerMm);
  return agreeing ?? (target.candidates.length === 1 ? target.candidates[0] : undefined);
}

/** Η μέση em των κειμένων διαστάσεων: το βήμα του χωρικού ευρετηρίου. */
const typicalEm = (texts: readonly DimensionText[]): number =>
  texts.length === 0 ? 1 : texts.reduce((sum, d) => sum + d.frame.em, 0) / texts.length;

/** Φ2β — τα σχεδιασμένα γραφικά των κειμένων διαστάσεων της σελίδας. */
function graphicsOf(content: PdfVectorContent, texts: readonly DimensionText[], segments: readonly PdfSegment[]): PdfDimensionGraphic[] {
  if (texts.length === 0 || segments.length === 0) return [];
  const grid = segmentGrid(segments, PDF_VECTOR_DIMENSION_GRAPHICS_LIMITS.ARROW_REACH_EM * typicalEm(texts));
  return detectDimensionGraphics(
    texts.map((d) => ({ textIndex: d.textIndex, frame: d.frame })),
    { segments, grid, fills: content.fills, polylines: content.polylines },
  );
}

/** Οι στόχοι: σχεδιασμένη διάσταση όπου υπάρχουν γραφικά, αλλιώς ακμές της Φ2α (χωρίς τις πολυγραμμές των γραφικών). */
function targetsOf(
  content: PdfVectorContent, texts: readonly DimensionText[], graphics: readonly PdfDimensionGraphic[],
  segments: readonly PdfSegment[], touched: ReadonlySet<number>,
): TextTarget[] {
  const byText = new Map(graphics.map((g) => [g.textIndex, g]));
  const edges = segments.filter((s) => !touched.has(s.polylineIndex));
  return texts.map((d) => {
    const g = byText.get(d.textIndex);
    return g ? graphicTarget(d, g, content.polylines, touched) : edgeTarget(d, edges);
  });
}

/** Οι γραμμένες τιμές της σελίδας, δεμένες στα σημεία που μετρούν (Δ10–Δ12, Δ17–Δ19). */
export function bindPdfDimensions(content: PdfVectorContent): PdfDimensionReading {
  const texts = dimensionTexts(content);
  const segments = polylineSegments(content.polylines);
  const graphics = graphicsOf(content, texts, segments);
  const targets = targetsOf(content, texts, graphics, segments, graphicPolylines(graphics, segments).touched);
  const voting = targets.filter((t) => t.candidates.length > 0);
  const pxPerMm = dimensionScaleConsensus(voting, DEFAULT_PLAN_FUSION)?.pxPerMm ?? null;
  const bindings = targets.flatMap((target): PdfDimensionBinding[] => {
    const pick = chosen(target, pxPerMm);
    return pick ? [{
      textIndex: target.textIndex, raw: target.raw, valueMm: target.dimension.valueMm, precisionMm: target.dimension.precisionMm,
      measured: pick.measured, linePoint: target.linePoint, arrowheads: target.arrowheads,
    }] : [];
  });
  // Δ19: απορροφώνται μόνο τα γραφικά διαστάσεων που ΔΕΘΗΚΑΝ — μια αδέσμευτη τιμή κρατά τις γραμμές της.
  const bound = new Set(bindings.map((b) => b.textIndex));
  const { absorbed } = graphicPolylines(graphics.filter((g) => bound.has(g.textIndex)), segments);
  return { bindings, pxPerMm, unbound: targets.length - bindings.length, absorbed };
}
