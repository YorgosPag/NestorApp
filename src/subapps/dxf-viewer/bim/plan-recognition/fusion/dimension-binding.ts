/**
 * ADR-929 Φ4 — **γεωμετρική δέση** των γραμμένων διαστάσεων (εύρημα #5 της Φ3): σε ποιες δύο παρειές αναφέρεται το «3.50».
 *
 * 🔑 **Η γεωμετρία μετρά, το VLM δείχνει (Δ1).** Το πλαίσιο του κειμένου είναι ακριβές (μετρήθηκε οπτικά), η δέση του
 * μοντέλου όχι (δένει τον τοίχο **κατά μήκος** του οποίου τρέχει η διάσταση). Άρα:
 * 1. ο **προσανατολισμός** του πλαισίου δίνει τη διεύθυνση μέτρησης (πλατύ ⇒ μετρά κατά x ⇒ κάθετες παρειές)·
 * 2. υποψήφια είναι τα ζεύγη ευθειών κάθετων στη διεύθυνση που **περικλείουν** το κείμενο και φτάνουν κοντά του·
 * 3. η ανάγνωση **ενισχύει** ένα υποψήφιο, δεν το επιλέγει. Η τελική επιλογή γίνεται από τη **συναίνεση κλίμακας**
 *    (`scale-consensus.ts`): το ζεύγος του οποίου η απόσταση συμφωνεί με την κλίμακα που στηρίζουν οι **υπόλοιπες** διαστάσεις.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/dimension-binding
 */

import type { Homography, PlanePoint } from '@/lib/geometry/homography';
import { originalRectToAligned } from '../alignment/alignment-region';
import type { PlanDimension, PlanInputKind, PlanReading, PlanText } from '../plan-recognition-types';
import { dimensionSigmaMm, writtenPrecisionMm } from './dimension-precision';
import { familyDirection, familyNormal, type FusionFrame } from './fusion-frame';
import type { DimensionBinding, FaceLine, PlanFusionOptions } from './plan-fusion-types';

export interface BindingCandidate {
  readonly lineA: FaceLine;
  readonly lineB: FaceLine;
  readonly gapPx: number;
  readonly score: number;
  /** Πόσο κάθεται το κείμενο στη μέση του ζεύγους, στο (0, 1]: το τεκμήριο που **δεν** εξαρτάται από την τιμή. */
  readonly centring: number;
  /** Πόσες από τις δύο ευθείες περιέχουν τμήμα που έδειξε και η ανάγνωση. */
  readonly readingHits: 0 | 1 | 2;
}

/** Μια διάσταση έτοιμη για τη σύντηξη: το κείμενό της, η ακρίβειά της, οι υποψήφιες δέσεις. */
export interface DimensionTarget {
  readonly dimension: PlanDimension;
  readonly text: PlanText;
  readonly precisionMm: number;
  readonly sigmaMm: number;
  /** Σχετική ανοχή «η απόσταση συμφωνεί με την τιμή», από τον θόρυβο γεωμετρίας **και** γραφής. */
  readonly toleranceRel: number;
  readonly candidates: readonly BindingCandidate[];
}

const READING_BONUS = [1, 1.5, 3] as const;
/** Πλαίσιο πλατύτερο από ψηλό κατά τόσο ⇒ σαφής προσανατολισμός. */
const ORIENTATION_RATIO = 1.25;
const FAMILY_HORIZONTAL = 0;
const FAMILY_VERTICAL = 1;

const dot = (a: PlanePoint, b: PlanePoint): number => a.x * b.x + a.y * b.y;

/** Οι οικογένειες των **μετρούμενων** παρειών: από τον προσανατολισμό του κειμένου, συν όσες έδειξε η ανάγνωση. */
function measuredFamilies(box: { w: number; h: number }, hintLines: readonly FaceLine[]): number[] {
  const byShape = box.w >= ORIENTATION_RATIO * box.h ? [FAMILY_VERTICAL]
    : box.h >= ORIENTATION_RATIO * box.w ? [FAMILY_HORIZONTAL]
      : [FAMILY_HORIZONTAL, FAMILY_VERTICAL];
  return [...new Set([...byShape, ...hintLines.map((l) => l.familyId)])];
}

/** Πόσο απέχει η ευθεία από το ύψος του κειμένου κατά μήκος της διεύθυνσής της (0 όταν το καλύπτει). */
const reachGap = (line: FaceLine, q: number): number => Math.max(0, line.extentMinPx - q, q - line.extentMaxPx);

function pairsInFamily(
  frame: FusionFrame,
  familyId: number,
  centre: PlanePoint,
  hint: ReadonlySet<string>,
  o: PlanFusionOptions,
): BindingCandidate[] {
  const family = frame.families[familyId];
  const p = dot(familyNormal(family), centre);
  const q = dot(familyDirection(family), centre);
  const reach = o.bindingReachFraction * frame.drawingSpanPx;
  const near = frame.lines.filter((l) => l.familyId === familyId && reachGap(l, q) <= reach);
  const left = near.filter((l) => l.offsetPx < p).sort((a, b) => b.offsetPx - a.offsetPx).slice(0, o.bindingNeighbours);
  const right = near.filter((l) => l.offsetPx > p).sort((a, b) => a.offsetPx - b.offsetPx).slice(0, o.bindingNeighbours);
  const proximity = (l: FaceLine): number => Math.exp(-reachGap(l, q) / (0.25 * reach));
  const out: BindingCandidate[] = [];
  for (const a of left) {
    for (const b of right) {
      const gapPx = b.offsetPx - a.offsetPx;
      const readingHits = ((hint.has(a.id) ? 1 : 0) + (hint.has(b.id) ? 1 : 0)) as 0 | 1 | 2;
      const centred = centring(p, a, b, o);
      const score = proximity(a) * proximity(b) * centred * READING_BONUS[readingHits];
      out.push({ lineA: a, lineB: b, gapPx, score, centring: centred, readingHits });
    }
  }
  return out;
}

/**
 * Το κείμενο μιας διάστασης γράφεται **στη μέση** της γραμμής διάστασης (το κάνει αυτόματα κάθε CAD, και ο σχεδιαστής με
 * το χέρι). Η απόσταση του κέντρου του κειμένου από το μέσο του ζεύγους, σε κλάσμα της απόστασης, είναι το **ισχυρότερο**
 * γεωμετρικό τεκμήριο για το ποιο ζεύγος μετρά — και δεν εξαρτάται από την τιμή, άρα δένει σωστά και μια **λάθος** τιμή.
 */
function centring(p: number, a: FaceLine, b: FaceLine, o: PlanFusionOptions): number {
  const gap = b.offsetPx - a.offsetPx;
  const off = (p - (a.offsetPx + b.offsetPx) / 2) / (o.centringRel * gap);
  return Math.exp(-0.5 * off * off);
}

function dimensionTarget(
  dimension: PlanDimension,
  text: PlanText,
  frame: FusionFrame,
  toAligned: Homography,
  kind: PlanInputKind,
  o: PlanFusionOptions,
): DimensionTarget {
  const box = originalRectToAligned(text.rect, toAligned);
  const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const hintIds = new Set(dimension.segmentIds.flatMap((id) => frame.lineOfSegment.get(id) ?? []));
  const hintLines = [...hintIds].flatMap((id) => frame.lineById.get(id) ?? []);
  const families = measuredFamilies({ w: box.maxX - box.minX, h: box.maxY - box.minY }, hintLines);
  const candidates = families.flatMap((f) => pairsInFamily(frame, f, centre, hintIds, o));
  const precisionMm = writtenPrecisionMm(text.raw, dimension.valueMm);
  const sigmaMm = dimensionSigmaMm(precisionMm, o.dimensionDraftSigmaMm);
  const toleranceMm = 3 * Math.hypot(Math.SQRT2 * o.cvSigmaMm[kind], sigmaMm);
  return { dimension, text, precisionMm, sigmaMm, toleranceRel: Math.max(o.bindingToleranceRel, toleranceMm / dimension.valueMm), candidates };
}

/** Κάθε διάσταση της ανάγνωσης με το κείμενό της ⇒ στόχος με υποψήφιες δέσεις. Διάσταση χωρίς κείμενο δεν δένεται. */
export function dimensionTargets(
  reading: PlanReading,
  frame: FusionFrame,
  toAligned: Homography,
  kind: PlanInputKind,
  o: PlanFusionOptions,
): DimensionTarget[] {
  const texts = new Map(reading.texts.map((t) => [t.id, t]));
  return reading.dimensions.flatMap((d) => {
    const text = texts.get(d.textId);
    return text ? [dimensionTarget(d, text, frame, toAligned, kind, o)] : [];
  });
}

/** Σχετική απόκλιση της απόστασης από την τιμή στην κλίμακα `pxPerMm`, σε λογαριθμικό χώρο (συμμετρική). */
export const relativeMismatch = (c: BindingCandidate, valueMm: number, pxPerMm: number): number =>
  Math.abs(Math.log(c.gapPx / (valueMm * pxPerMm)));

/**
 * ⚠️ Η ασάφεια μετρά **μόνο** στη βαθμίδα 1. Στη βαθμίδα 2 **κανένα** ζεύγος δεν δίνει την τιμή, οπότε το συμπέρασμα
 * «η γραμμένη τιμή διαφωνεί με το σχέδιο» ισχύει όποιο κι αν είναι το σωστό ζεύγος (εσωτερική παρειά ή άξονας τοίχου):
 * διφορούμενη δέση εκεί θα έκρυβε μια πραγματική σύγκρουση πίσω από ένα «δεν ξέρω πού δένει».
 */
function toBinding(best: BindingCandidate, pool: readonly BindingCandidate[], withinTolerance: boolean, o: PlanFusionOptions): DimensionBinding {
  const rival = pool.find((c) => c.lineA.id !== best.lineA.id || c.lineB.id !== best.lineB.id);
  return {
    lineA: best.lineA.id,
    lineB: best.lineB.id,
    gapPx: best.gapPx,
    score: best.score,
    source: best.readingHits === 2 ? 'geometry+reading' : 'geometry',
    ambiguous: withinTolerance && rival !== undefined && rival.score >= o.ambiguityRatio * best.score,
    withinTolerance,
  };
}

/**
 * Η δέση στην κλίμακα που αποφασίστηκε, σε δύο βαθμίδες:
 * 1. το καλύτερο υποψήφιο **μέσα στην ανοχή** (η τιμή ταιριάζει)·
 * 2. αλλιώς το **γεωμετρικά** καλύτερο (κεντράρισμα, εγγύτητα, ανάγνωση), αν η τιμή απέχει έως `maxBlunderRel`: πιθανή
 *    λάθος γραμμένη τιμή, που ο λύτης θα κρίνει (Δ8: «γράφει 3,50, η γεωμετρία δίνει 3,20»).
 * Διφορούμενη όταν ένα **άλλο** ζεύγος της ίδιας βαθμίδας έχει σχεδόν τον ίδιο βαθμό. `null` ⇒ κανένα ζεύγος.
 */
export function selectBinding(target: DimensionTarget, pxPerMm: number, o: PlanFusionOptions): DimensionBinding | null {
  const valueMm = target.dimension.valueMm;
  const byScore = [...target.candidates].sort((a, b) => b.score - a.score);
  const bestCentring = Math.max(0, ...byScore.map((c) => c.centring));
  // Βαθμίδα 1 με φράχτη κεντραρίσματος: ένα ζεύγος που ταιριάζει στην τιμή **κατά σύμπτωση** (τοίχοι 25 εκ. ⇒ πολλές
  // σχεδόν ίσες αποστάσεις) αλλά δεν έχει το κείμενο στη μέση του δεν κερδίζει το ζεύγος που το έχει.
  const within = byScore.filter((c) => relativeMismatch(c, valueMm, pxPerMm) <= target.toleranceRel && c.centring >= o.tier1CentringRel * bestCentring);
  if (within.length > 0) return toBinding(within[0], within, true, o);
  const plausible = byScore.filter((c) => {
    const diffMm = Math.abs(c.gapPx / pxPerMm - valueMm);
    return relativeMismatch(c, valueMm, pxPerMm) <= o.maxBlunderRel || diffMm <= o.maxBlunderMm;
  });
  return plausible.length > 0 ? toBinding(plausible[0], plausible, false, o) : null;
}
