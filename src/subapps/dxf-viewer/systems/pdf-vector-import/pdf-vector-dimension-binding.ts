/**
 * ADR-941 Φ2α — **ποια γραμμένη τιμή μετρά ποια ακμή** στο διανυσματικό PDF. Καθαρό, σε px της σελίδας (ένας χώρος για
 * γεωμετρία και κείμενα, πριν από τη σκηνή).
 *
 * 🔑 **Δ10 — τι είναι διάσταση:** κείμενο που διαβάζεται ως μήκος (`parseDimensionValue`, ο ΕΝΑΣ αναγνώστης τιμών· μονάδα σκέτου
 *   ακεραίου από **όλα** τα κείμενα διαστάσεων της σελίδας) **και** δένεται σε ακμή. Οτιδήποτε άλλο μένει κείμενο.
 * 🔑 **Δ11 — υποψήφιες ακμές:** παράλληλες με τη γραμμή βάσης, με το κέντρο του κειμένου σε λίγα em κάθετα και την προβολή του
 *   **μέσα** στην ακμή. Το βάρος πέφτει με την απόσταση (σε em).
 * 🔑 **Δ12 — επιλογή με συναίνεση κλίμακας:** ψήφος = μήκος / τιμή, η **ίδια** μηχανή με τον ADR-929 (`scale-consensus`).
 *   Μοναδικό υποψήφιο ⇒ δεμένο (η γεωμετρία δεν αφήνει αμφισημία). Αμφίσημο χωρίς συναίνεση ⇒ **αδέσμευτο**, μετρημένο —
 *   ποτέ μαντεψιά.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-dimension-binding
 */

import type { PdfVectorContent, PdfVectorPolyline, PdfVectorText, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import {
  classifyWrittenText,
  inferBareIntegerUnit,
  parseDimensionValue,
  type BareIntegerUnit,
} from '../../bim/plan-recognition/reading/written-values';
import {
  agreeingCandidate,
  dimensionScaleConsensus,
  type ScaleVoteCandidate,
  type ScaleVoteTarget,
} from '../../bim/plan-recognition/fusion/scale-consensus';
import { DEFAULT_PLAN_FUSION } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import { PDF_VECTOR_DIMENSION_LIMITS } from '../../config/tolerance-config';
import { PDF_EM_TO_CAP_HEIGHT } from './pdf-vector-entities';

/** Μια ακμή της εισαγωγής: η πολυγραμμή (δείκτης στο `content.polylines`) και οι δύο κορυφές της. */
export interface PdfEdgeRef {
  readonly polylineIndex: number;
  readonly from: number;
  readonly to: number;
}

/** Μια γραμμένη τιμή δεμένη στην ακμή που μετρά. */
export interface PdfDimensionBinding {
  /** Δείκτης στο `content.texts`. */
  readonly textIndex: number;
  readonly raw: string;
  readonly valueMm: number;
  /** Το μέγεθος του τελευταίου γραμμένου ψηφίου, σε mm. */
  readonly precisionMm: number;
  readonly edge: PdfEdgeRef;
  /** Το μέσο της γραμμής βάσης του κειμένου: από εδώ περνά η γραμμή διάστασης. */
  readonly baselineMid: PxPoint;
}

export interface PdfDimensionReading {
  readonly bindings: readonly PdfDimensionBinding[];
  /** Η κλίμακα που αποδεικνύουν οι γραμμένες τιμές (px της σελίδας ανά mm), ή `null`. */
  readonly pxPerMm: number | null;
  /** Τιμές μήκους που **δεν** δέθηκαν (καμία ή αμφίσημη ακμή): μένουν κείμενα. */
  readonly unbound: number;
}

interface EdgeCandidate extends ScaleVoteCandidate {
  readonly edge: PdfEdgeRef;
}

interface TextTarget extends ScaleVoteTarget<EdgeCandidate> {
  readonly textIndex: number;
  readonly raw: string;
  readonly dimension: { readonly valueMm: number; readonly precisionMm: number };
  readonly baselineMid: PxPoint;
}

/** Το πλαίσιο ενός κειμένου στα px: κέντρο, διεύθυνση ανάγνωσης, em. */
interface TextFrame {
  readonly centre: PxPoint;
  readonly baselineMid: PxPoint;
  readonly dir: PxPoint;
  readonly em: number;
}

const sub = (a: PxPoint, b: PxPoint): PxPoint => [a[0] - b[0], a[1] - b[1]];
const cross = (a: PxPoint, b: PxPoint): number => a[0] * b[1] - a[1] * b[0];
const dot = (a: PxPoint, b: PxPoint): number => a[0] * b[0] + a[1] * b[1];
const length = (a: PxPoint): number => Math.hypot(a[0], a[1]);

function textFrame(text: PdfVectorText): TextFrame | null {
  const along = sub(text.along, text.origin);
  const up = sub(text.up, text.origin);
  const em = length(up);
  const alongLen = length(along);
  if (!(em > 0) || !(alongLen > 0)) return null;
  const baselineMid: PxPoint = [(text.origin[0] + text.end[0]) / 2, (text.origin[1] + text.end[1]) / 2];
  const lift = PDF_EM_TO_CAP_HEIGHT / 2; // το κέντρο του ύψους κεφαλαίου, πάνω από τη γραμμή βάσης
  const centre: PxPoint = [baselineMid[0] + up[0] * lift, baselineMid[1] + up[1] * lift];
  return { centre, baselineMid, dir: [along[0] / alongLen, along[1] / alongLen], em };
}

/** Οι ακμές μιας πολυγραμμής, με τις κορυφές τους (και η κλείνουσα, όταν είναι κλειστή). */
function edgesOf(polyline: PdfVectorPolyline, polylineIndex: number): PdfEdgeRef[] {
  const n = polyline.points.length;
  const edges: PdfEdgeRef[] = [];
  for (let i = 0; i + 1 < n; i++) edges.push({ polylineIndex, from: i, to: i + 1 });
  if (polyline.closed && n > 2) edges.push({ polylineIndex, from: n - 1, to: 0 });
  return edges;
}

/** Η ακμή ως υποψήφιο του κειμένου, ή `null` όταν δεν είναι παράλληλη, κοντινή και «κάτω» από το κείμενο. */
function candidateOf(edge: PdfEdgeRef, content: PdfVectorContent, frame: TextFrame): EdgeCandidate | null {
  const points = content.polylines[edge.polylineIndex].points;
  const a = points[edge.from];
  const w = sub(points[edge.to], a);
  const gapPx = length(w);
  if (!(gapPx > 0)) return null;
  const wn: PxPoint = [w[0] / gapPx, w[1] / gapPx];
  if (Math.abs(cross(frame.dir, wn)) > PDF_VECTOR_DIMENSION_LIMITS.PARALLEL_SIN) return null;
  const rel = sub(frame.centre, a);
  const offsetEm = Math.abs(cross(wn, rel)) / frame.em;
  if (offsetEm > PDF_VECTOR_DIMENSION_LIMITS.MAX_OFFSET_EM) return null;
  const t = dot(rel, wn);
  if (t < 0 || t > gapPx) return null;
  return { edge, gapPx, score: 1 / (1 + offsetEm), readingHits: 0, extensionHits: 0 };
}

function targetOf(
  text: PdfVectorText, textIndex: number, unit: BareIntegerUnit, edges: readonly PdfEdgeRef[],
  content: PdfVectorContent,
): TextTarget | null {
  const value = parseDimensionValue(text.text, unit);
  const frame = value ? textFrame(text) : null;
  if (!value || !frame) return null;
  const candidates = edges.flatMap((e) => candidateOf(e, content, frame) ?? []);
  return {
    textIndex,
    raw: text.text,
    dimension: { valueMm: value.valueMm, precisionMm: value.precisionMm },
    // Μία πλήρης μονάδα του τελευταίου ψηφίου: στρογγυλοποίηση (±½) και περιθώριο σχεδίασης (±½).
    toleranceRel: value.precisionMm / value.valueMm,
    candidates,
    baselineMid: frame.baselineMid,
  };
}

/** Η ακμή του στόχου: της κλίμακας, αλλιώς η μόνη υποψήφια· αμφίσημο ⇒ `undefined`. */
function chosenEdge(target: TextTarget, pxPerMm: number | null): EdgeCandidate | undefined {
  const agreeing = pxPerMm === null ? undefined : agreeingCandidate(target, pxPerMm);
  return agreeing ?? (target.candidates.length === 1 ? target.candidates[0] : undefined);
}

/** Οι γραμμένες τιμές της σελίδας, δεμένες στις ακμές που μετρούν (Δ10–Δ12). */
export function bindPdfDimensions(content: PdfVectorContent): PdfDimensionReading {
  const lengthTexts = content.texts.filter((t) => classifyWrittenText(t.text) === 'dimension');
  const unit = inferBareIntegerUnit(lengthTexts.map((t) => t.text));
  const edges = content.polylines.flatMap(edgesOf);
  const targets = content.texts.flatMap((text, i) =>
    (classifyWrittenText(text.text) === 'dimension' ? targetOf(text, i, unit, edges, content) ?? [] : []));
  const voting = targets.filter((t) => t.candidates.length > 0);
  const pxPerMm = dimensionScaleConsensus(voting, DEFAULT_PLAN_FUSION)?.pxPerMm ?? null;
  const bindings: PdfDimensionBinding[] = [];
  for (const target of targets) {
    const chosen = chosenEdge(target, pxPerMm);
    if (!chosen) continue;
    bindings.push({
      textIndex: target.textIndex,
      raw: target.raw,
      valueMm: target.dimension.valueMm,
      precisionMm: target.dimension.precisionMm,
      edge: chosen.edge,
      baselineMid: target.baselineMid,
    });
  }
  return { bindings, pxPerMm, unbound: targets.length - bindings.length };
}
